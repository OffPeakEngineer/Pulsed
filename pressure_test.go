package main

import (
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/shirou/gopsutil/v3/disk"
)

func TestDiskFamilies(t *testing.T) {
	for name, want := range map[string]string{"nvme0n1": "nvme", "/dev/nvme1n1": "nvme", "mmcblk0": "mmc", "sda": "sd", "xvdb": "xvd", "vda": "vd", "disk0": "disk", "nvme0n1+nvme1n1": "nvme", "nvme0n1+mmcblk0": "mixed", "archive": "other", "": "other"} {
		if got := diskFamily(name); got != want {
			t.Errorf("%q: got %q, want %q", name, got, want)
		}
	}
	usage := func(string) (*disk.UsageStat, error) { return &disk.UsageStat{Total: 100, Used: 50, Free: 50}, nil }
	parts := []disk.PartitionStat{{Device: "/dev/nvme0n1p1", Mountpoint: "/"}, {Device: "/dev/mmcblk0p1", Mountpoint: "/boot"}}
	resolve := func(device string) diskIdentity { return diskIdentity{strings.TrimSuffix(device, "p1"), device} }
	result := aggregateDisks(parts, usage, resolve, "", "", "system=/")
	if len(result) != 2 || result[1].Name != "system" || result[1].Type != "nvme" {
		t.Fatalf("custom label lost device type: %+v", result)
	}
	result = aggregateDisks(parts, usage, resolve, "", "", "system=/,/boot")
	if len(result) != 1 || result[0].Type != "mixed" {
		t.Fatalf("heterogeneous custom group: %+v", result)
	}
}

func TestClusterPressureWeightsCapacityAndExcludesOldReadings(t *testing.T) {
	now := time.Now()
	nodes := []NodeStats{
		{Name: "small", UpdatedAt: now.UnixNano(), MemUsed: 10, MemTotal: 100, Disks: []DiskStats{{Name: "nvme0n1", Used: 10, Total: 100}, {Name: "mmcblk0", Total: 100}}},
		{Name: "large", UpdatedAt: now.UnixNano(), MemUsed: 810, MemTotal: 900, Disks: []DiskStats{{Name: "archive", Type: "nvme", Used: 810, Total: 900}, {Name: "invalid", Used: 101, Total: 100}, {Name: "missing"}}},
		{Name: "stale", UpdatedAt: now.Add(-11 * time.Second).UnixNano(), MemUsed: 10000, MemTotal: 10000, Disks: []DiskStats{{Name: "nvme0n1", Used: 10000, Total: 10000}}},
		{Name: "offline", UpdatedAt: now.Add(-time.Hour).UnixNano(), MemUsed: 10000, MemTotal: 10000, Disks: []DiskStats{{Name: "nvme0n1", Used: 10000, Total: 10000}}},
		{Name: "legacy", UpdatedAt: now.UnixNano()},
	}
	p := summarizePressure(nodes)
	if p.Memory.Count != 2 || p.Memory.Total != 1000 || p.Memory.Used != 820 || p.Memory.Percent() != 82 {
		t.Fatalf("memory pressure: %+v", p.Memory)
	}
	if len(p.Disks) != 2 || p.Disks[0].Name != "mmc" || p.Disks[0].Percent() != 0 || p.Disks[1].Name != "nvme" || p.Disks[1].Count != 2 || p.Disks[1].Percent() != 82 {
		t.Fatalf("disk pressure: %+v", p.Disks)
	}
	empty := summarizePressure(nodes[2:])
	if empty.Memory.Total != 0 || empty.Memory.Percent() != 0 || len(empty.Disks) != 0 {
		t.Fatalf("empty pressure: %+v", empty)
	}
}

func TestDashboardClusterPressureRefreshesWithSnapshot(t *testing.T) {
	db := openTestDB(t)
	handler := makeHandler(db, "node")
	stats := NodeStats{Name: "node", UpdatedAt: time.Now().UnixNano(), MemTotal: 100, MemUsed: 90, Disks: []DiskStats{{Name: "nvme0n1", Total: 100, Used: 75}}}
	if err := dbSet(db, stats); err != nil {
		t.Fatal(err)
	}
	read := func() string {
		t.Helper()
		rr := httptest.NewRecorder()
		handler.ServeHTTP(rr, httptest.NewRequest("GET", "/", nil))
		if rr.Code != 200 {
			t.Fatalf("dashboard status %d: %s", rr.Code, rr.Body.String())
		}
		start := strings.Index(rr.Body.String(), `class="cluster-pressure"`)
		if start < 0 {
			t.Fatal("missing cluster pressure")
		}
		return strings.Split(rr.Body.String()[start:], `id="snapshot-notice"`)[0]
	}
	first := read()
	for _, want := range []string{"nvme", "75%", "Memory", "90%", "#ef4444", "#eab308", "1 node"} {
		if !strings.Contains(first, want) {
			t.Errorf("missing %q", want)
		}
	}
	stats.MemUsed = 0
	stats.Disks[0].Used = 0
	if err := dbSet(db, stats); err != nil {
		t.Fatal(err)
	}
	updated := read()
	if strings.Contains(updated, "90%") || strings.Contains(updated, "75%") || !strings.Contains(updated, "0%") {
		t.Fatal("summary retained prior readings")
	}
	stats.UpdatedAt = time.Now().Add(-time.Hour).UnixNano()
	if err := dbSet(db, stats); err != nil {
		t.Fatal(err)
	}
	empty := read()
	if !strings.Contains(empty, "No fresh disk readings") || !strings.Contains(empty, "Unavailable") || strings.Contains(empty, ">0%<") {
		t.Fatal("unavailable capacity rendered as zero")
	}
}
