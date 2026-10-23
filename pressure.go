package main

import (
	"fmt"
	"path/filepath"
	"sort"
	"strings"
)

// Device families describe OS naming, not a guess at SSD/HDD media type.
// Keep heterogeneous pools together because capacity cannot be split by type.
func diskFamily(name string) string {
	family := ""
	for _, device := range strings.Split(name, "+") {
		device = strings.ToLower(filepath.Base(device))
		current := "other"
		for _, prefix := range []string{"nvme", "mmcblk", "xvd", "vd", "sd", "hd", "disk"} {
			if strings.HasPrefix(device, prefix) && len(device) > len(prefix) {
				suffix := device[len(prefix)]
				numeric := prefix == "nvme" || prefix == "mmcblk" || prefix == "disk"
				if numeric && suffix >= '0' && suffix <= '9' || !numeric && suffix >= 'a' && suffix <= 'z' {
					current = prefix
					if prefix == "mmcblk" {
						current = "mmc"
					}
					break
				}
			}
		}
		if family != "" && family != current {
			return "mixed"
		}
		family = current
	}
	return family
}

func normalizedDiskFamily(d DiskStats) string {
	switch d.Type {
	case "nvme", "mmc", "sd", "hd", "vd", "xvd", "disk", "mixed", "other":
		return d.Type
	}
	// Peers predating type metadata still contribute using their device name.
	return diskFamily(d.Name)
}

type capacityPressure struct {
	Name        string
	Used, Total uint64
	Count       int
}

func (p capacityPressure) Percent() float64 {
	if p.Total == 0 {
		return 0
	}
	return metricPercent(float64(p.Used) / float64(p.Total) * 100)
}
func (p capacityPressure) Label() string {
	return fmt.Sprintf("%s · %.1f%% used · %s / %s · fresh node readings", p.Name, p.Percent(), fmtBytes(p.Used), fmtBytes(p.Total))
}

type clusterPressure struct {
	Memory capacityPressure
	Disks  []capacityPressure
}

func summarizePressure(nodes []NodeStats) clusterPressure {
	pressure := clusterPressure{Memory: capacityPressure{Name: "Memory"}}
	families := map[string]*capacityPressure{}
	for _, node := range nodes {
		if nodeHealth(node).State != healthFresh {
			continue
		}
		if node.MemTotal > 0 && node.MemUsed <= node.MemTotal {
			pressure.Memory.Used += node.MemUsed
			pressure.Memory.Total += node.MemTotal
			pressure.Memory.Count++
		}
		for _, disk := range node.Disks {
			if disk.Total == 0 || disk.Used > disk.Total {
				continue
			}
			family := normalizedDiskFamily(disk)
			p := families[family]
			if p == nil {
				p = &capacityPressure{Name: family}
				families[family] = p
			}
			p.Used += disk.Used
			p.Total += disk.Total
			p.Count++
		}
	}
	for _, p := range families {
		pressure.Disks = append(pressure.Disks, *p)
	}
	sort.Slice(pressure.Disks, func(i, j int) bool { return pressure.Disks[i].Name < pressure.Disks[j].Name })
	return pressure
}
