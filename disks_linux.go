package main

import (
	"fmt"
	"path/filepath"

	"github.com/shirou/gopsutil/v3/disk"
	"golang.org/x/sys/unix"
)

// Mount device names such as /dev/root may have no corresponding device node.
// Resolve their kernel major/minor identity through sysfs instead.
func platformPartition(p disk.PartitionStat) disk.PartitionStat {
	if len(p.Device) < 5 || p.Device[:5] != "/dev/" {
		return p
	}
	var stat unix.Stat_t
	if unix.Stat(p.Mountpoint, &stat) == nil {
		target, err := filepath.EvalSymlinks(fmt.Sprintf("/sys/dev/block/%d:%d", unix.Major(uint64(stat.Dev)), unix.Minor(uint64(stat.Dev))))
		if err == nil {
			p.Device = "/dev/" + filepath.Base(target)
		}
	}
	return p
}
