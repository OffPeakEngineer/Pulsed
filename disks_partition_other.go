//go:build !linux

package main

import "github.com/shirou/gopsutil/v3/disk"

func platformPartition(p disk.PartitionStat) disk.PartitionStat { return p }
