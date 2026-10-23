package main

import (
	"errors"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/shirou/gopsutil/v3/disk"
)

func TestAggregateDiskCapacity(t *testing.T) {
	partitions := []disk.PartitionStat{
		{Device: "/dev/sda1", Mountpoint: "/", Fstype: "ext4"},
		{Device: "/dev/sda1", Mountpoint: "/bind", Fstype: "ext4"},
		{Device: "/dev/sda2", Mountpoint: "/home", Fstype: "ext4"},
		{Device: "/dev/sdb1", Mountpoint: "/archive", Fstype: "ext4"},
		{Device: "tmpfs", Mountpoint: "/run", Fstype: "tmpfs"},
		{Device: "/dev/loop0", Mountpoint: "/snap/tool", Fstype: "squashfs"},
		{Device: "/dev/sdc1", Mountpoint: "/broken", Fstype: "ext4"},
	}
	usage := func(mount string) (*disk.UsageStat, error) {
		if mount == "/broken" {
			return nil, errors.New("unavailable")
		}
		if mount == "/home" {
			return &disk.UsageStat{Total: 300, Used: 270, Free: 30}, nil
		}
		return &disk.UsageStat{Total: 100, Used: 50, Free: 40}, nil
	}
	resolve := func(device string) diskIdentity { return diskIdentity{device[:8], device} }
	result := aggregateDisks(partitions, usage, resolve, "", "", "")
	if len(result) != 2 || result[0].Total != 400 || result[0].Used != 320 || result[0].Free != 70 || result[0].Percent() != 80 || len(result[0].Mounts) != 2 {
		t.Fatalf("unexpected capacity: %+v", result)
	}
	result = aggregateDisks(partitions, usage, resolve, "/home,/archive", "/archive", "system=/home")
	if len(result) != 1 || result[0].Name != "system" || result[0].Total != 300 {
		t.Fatalf("unexpected filters/groups: %+v", result)
	}
	// Multiple volumes may expose the same capacity pool (APFS).
	result = aggregateDisks(partitions[:3], usage, func(string) diskIdentity { return diskIdentity{"disk0", "apfs:container"} }, "", "", "")
	if len(result) != 1 || result[0].Total != 100 {
		t.Fatalf("shared space counted repeatedly: %+v", result)
	}
}
func TestLinuxDiskTopology(t *testing.T) {
	root := t.TempDir()
	class := filepath.Join(root, "class")
	must := func(err error) {
		t.Helper()
		if err != nil {
			t.Fatal(err)
		}
	}
	must(os.MkdirAll(class, 0755))
	for _, name := range []string{"sda", "sdb", "nvme0n1", "dm-0", "md0"} {
		target := filepath.Join(root, "devices", name)
		must(os.MkdirAll(filepath.Join(target, "slaves"), 0755))
		must(os.Symlink(target, filepath.Join(class, name)))
	}
	for part, parent := range map[string]string{"sda1": "sda", "sda2": "sda", "sdb1": "sdb", "nvme0n1p2": "nvme0n1"} {
		target := filepath.Join(root, "devices", parent, part)
		must(os.MkdirAll(target, 0755))
		must(os.WriteFile(filepath.Join(target, "partition"), []byte("1"), 0644))
		must(os.Symlink(target, filepath.Join(class, part)))
	}
	must(os.Symlink(filepath.Join(class, "sda2"), filepath.Join(root, "devices/dm-0/slaves/sda2")))
	for _, part := range []string{"sda1", "sdb1"} {
		must(os.Symlink(filepath.Join(class, part), filepath.Join(root, "devices/md0/slaves", part)))
	}
	for device, want := range map[string]string{"sda1": "sda", "sda2": "sda", "nvme0n1p2": "nvme0n1", "dm-0": "sda", "md0": "sda+sdb", "missing": ""} {
		if got := linuxDiskGroup(class, device, map[string]bool{}); got != want {
			t.Errorf("%s: got %q want %q", device, got, want)
		}
	}
}
func TestDiskSnapshotFreshness(t *testing.T) {
	now := time.Now()
	stats := NodeStats{Name: "node", UpdatedAt: now.UnixNano(), Disks: []DiskStats{{Name: "sda", Total: 100, Used: 95, Free: 5, Mounts: []string{"/"}}}}
	snapshot := makeAPISnapshot([]NodeStats{stats}, newCPUHistory(), "node", httptest.NewRequest("GET", "/api/v1/snapshot", nil), now)
	if len(snapshot.Nodes[0].Disks) != 1 {
		t.Fatal("missing disk metrics")
	}
	stats.UpdatedAt = now.Add(-time.Hour).UnixNano()
	snapshot = makeAPISnapshot([]NodeStats{stats}, newCPUHistory(), "node", httptest.NewRequest("GET", "/api/v1/snapshot", nil), now)
	if len(snapshot.Nodes[0].Disks) != 0 || len(dashboardCell(stats).Disks) != 0 {
		t.Fatal("offline node retained current disk readings")
	}
}

func TestDiskDashboardRendering(t *testing.T) {
	stats := NodeStats{Name: "node", UpdatedAt: time.Now().UnixNano(), Disks: []DiskStats{{Name: "sda", Total: 100, Used: 95, Free: 5, Mounts: []string{"/"}}}}
	cell := dashboardCell(stats)
	var output strings.Builder
	if err := pageTmpl.Execute(&output, pageData{Nodes: []cellData{cell}}); err != nil {
		t.Fatal(err)
	}
	for _, want := range []string{"disk-cylinder", "sda", "95%", "#ef4444"} {
		if !strings.Contains(output.String(), want) {
			t.Errorf("missing %q", want)
		}
	}
	if !strings.Contains(renderANSI(stats), "sda") {
		t.Fatal("terminal missing disk")
	}
}
