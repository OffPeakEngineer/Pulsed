package main

import (
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strings"

	"github.com/shirou/gopsutil/v3/disk"
)

// DiskStats describes mounted filesystem capacity, not raw device capacity.
// Multi-device filesystems stay together: their capacity cannot be attributed
// accurately to individual physical devices.
type DiskStats struct {
	Name   string   `json:"name"`
	Total  uint64   `json:"total"`
	Used   uint64   `json:"used"`
	Free   uint64   `json:"free"`
	Mounts []string `json:"mounts"`
}

func (d DiskStats) Percent() float64 {
	if d.Total == 0 {
		return 0
	}
	return metricPercent(float64(d.Used) / float64(d.Total) * 100)
}
func (d DiskStats) Label() string {
	return d.Name + " · " + fmtBytes(d.Used) + " / " + fmtBytes(d.Total) + " · " + strings.Join(d.Mounts, ", ")
}

type diskIdentity struct{ group, filesystem string }

func collectDisks() []DiskStats {
	partitions, err := disk.Partitions(false)
	if err != nil {
		return nil
	}
	for i, p := range partitions {
		partitions[i] = platformPartition(p)
	}
	return aggregateDisks(partitions, disk.Usage, resolveDisk, os.Getenv("PULSED_DISK_INCLUDE"), os.Getenv("PULSED_DISK_EXCLUDE"), os.Getenv("PULSED_DISK_GROUPS"))
}

// Patterns match whole mount paths (filepath.Match); a literal path also matches.
func mountMatches(mount, patterns string) bool {
	for _, pattern := range splitCSV(patterns) {
		if ok, _ := filepath.Match(pattern, mount); ok {
			return true
		}
	}
	return false
}
func aggregateDisks(partitions []disk.PartitionStat, usage func(string) (*disk.UsageStat, error), resolve func(string) diskIdentity, include, exclude, overrides string) []DiskStats {
	groups := map[string]*DiskStats{}
	seen := map[string]bool{}
	// Prefer a filesystem's root mount over bind mounts and APFS aliases.
	sort.SliceStable(partitions, func(i, j int) bool { return len(partitions[i].Mountpoint) < len(partitions[j].Mountpoint) })
	for _, p := range partitions {
		if !strings.HasPrefix(p.Device, "/dev/") && !(runtime.GOOS == "windows" && len(p.Device) >= 2 && p.Device[1] == ':') {
			continue
		}
		if p.Fstype == "autofs" || p.Fstype == "devfs" || p.Fstype == "squashfs" {
			continue
		}
		if include != "" && !mountMatches(p.Mountpoint, include) || mountMatches(p.Mountpoint, exclude) {
			continue
		}
		identity := resolve(p.Device)
		// APFS must have a container identity to avoid counting shared space repeatedly.
		if runtime.GOOS == "darwin" && p.Fstype == "apfs" && !strings.HasPrefix(identity.filesystem, "apfs:") {
			continue
		}
		if identity.group == "" || identity.filesystem == "" || seen[identity.filesystem] {
			continue
		}
		u, err := usage(p.Mountpoint)
		if err != nil || u.Total == 0 {
			continue
		}
		seen[identity.filesystem] = true
		for _, rule := range strings.Split(overrides, ";") {
			pair := strings.SplitN(rule, "=", 2)
			if len(pair) == 2 && strings.TrimSpace(pair[0]) != "" && mountMatches(p.Mountpoint, pair[1]) {
				identity.group = strings.TrimSpace(pair[0])
				break
			}
		}
		d := groups[identity.group]
		if d == nil {
			d = &DiskStats{Name: identity.group}
			groups[identity.group] = d
		}
		d.Total += u.Total
		d.Used += u.Used
		d.Free += u.Free
		d.Mounts = append(d.Mounts, p.Mountpoint)
	}
	var out []DiskStats
	for _, d := range groups {
		sort.Strings(d.Mounts)
		out = append(out, *d)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out
}

func resolveDisk(device string) diskIdentity {
	canonical, err := filepath.EvalSymlinks(device)
	if err != nil {
		canonical = device
	}
	if d, ok := platformDisk(canonical); ok {
		return d
	}
	name := filepath.Base(canonical)
	if runtime.GOOS == "linux" {
		if group := linuxDiskGroup("/sys/class/block", name, map[string]bool{}); group != "" {
			return diskIdentity{group, canonical}
		}
	}
	// Unknown topology is retained as an explicitly named device, never guessed
	// by stripping trailing digits (which would break NVMe and mapper names).
	return diskIdentity{name, canonical}
}
func linuxDiskGroup(root, name string, visiting map[string]bool) string {
	if visiting[name] {
		return ""
	}
	visiting[name] = true
	defer delete(visiting, name)
	path, err := filepath.EvalSymlinks(filepath.Join(root, name))
	if err != nil {
		return ""
	}
	if _, err := os.Stat(filepath.Join(path, "partition")); err == nil {
		return linuxDiskGroup(root, filepath.Base(filepath.Dir(path)), visiting)
	}
	slaves, _ := os.ReadDir(filepath.Join(path, "slaves"))
	var parents []string
	for _, slave := range slaves {
		if p := linuxDiskGroup(root, slave.Name(), visiting); p != "" {
			parents = append(parents, strings.Split(p, "+")...)
		}
	}
	sort.Strings(parents)
	parents = compactDiskNames(parents)
	if len(parents) > 0 {
		return strings.Join(parents, "+")
	}
	return name
}
func compactDiskNames(names []string) []string {
	var out []string
	for _, name := range names {
		if len(out) == 0 || out[len(out)-1] != name {
			out = append(out, name)
		}
	}
	return out
}
