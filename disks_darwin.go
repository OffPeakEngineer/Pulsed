package main

import (
	"context"
	"encoding/xml"
	"os/exec"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"
)

// diskutil's plist contains the physical stores behind each APFS container.
// Cache topology rather than invoking a subprocess on every heartbeat.
var macPartition = regexp.MustCompile(`^(disk[0-9]+)s[0-9]+$`)
var macSnapshot = regexp.MustCompile(`^(/dev/disk[0-9]+s[0-9]+)s[0-9]+$`)
var apfsTopology struct {
	sync.Mutex
	at    time.Time
	disks map[string]diskIdentity
}

func platformDisk(device string) (diskIdentity, bool) {
	apfsTopology.Lock()
	defer apfsTopology.Unlock()
	if time.Since(apfsTopology.at) > time.Minute {
		apfsTopology.at = time.Now()
		apfsTopology.disks = map[string]diskIdentity{}
		ctx, cancel := context.WithTimeout(context.Background(), time.Second)
		defer cancel()
		data, err := exec.CommandContext(ctx, "/usr/sbin/diskutil", "apfs", "list", "-plist").Output()
		if err == nil {
			var root plistValue
			if xml.Unmarshal(data, &root) == nil {
				for _, container := range root.dict["Containers"].array {
					var stores []string
					for _, store := range container.dict["PhysicalStores"].array {
						if s := store.dict["DeviceIdentifier"].text; s != "" {
							stores = append(stores, macPartition.ReplaceAllString(s, "$1"))
						}
					}
					if len(stores) == 0 {
						continue
					}
					sort.Strings(stores)
					containerID := container.dict["ContainerReference"].text
					if containerID == "" {
						continue
					}
					group := strings.Join(compactDiskNames(stores), "+")
					for _, volume := range container.dict["Volumes"].array {
						id := volume.dict["DeviceIdentifier"].text
						if id != "" {
							apfsTopology.disks["/dev/"+id] = diskIdentity{group, "apfs:" + containerID}
						}
					}
				}
			}
		}
	}
	device = macSnapshot.ReplaceAllString(device, "$1")
	d, ok := apfsTopology.disks[device]
	if ok {
		return d, true
	}
	name := strings.TrimPrefix(device, "/dev/")
	if macPartition.MatchString(name) {
		return diskIdentity{macPartition.ReplaceAllString(name, "$1"), device}, true
	}
	return diskIdentity{}, false
}

type plistValue struct {
	text  string
	dict  map[string]plistValue
	array []plistValue
}

func (v *plistValue) UnmarshalXML(d *xml.Decoder, start xml.StartElement) error {
	if start.Name.Local == "string" {
		return d.DecodeElement(&v.text, &start)
	}
	v.dict = map[string]plistValue{}
	key := ""
	for {
		token, err := d.Token()
		if err != nil {
			return err
		}
		switch t := token.(type) {
		case xml.StartElement:
			if t.Name.Local == "key" {
				if err := d.DecodeElement(&key, &t); err != nil {
					return err
				}
				continue
			}
			var child plistValue
			if err := d.DecodeElement(&child, &t); err != nil {
				return err
			}
			if start.Name.Local == "plist" {
				*v = child
			} else if start.Name.Local == "array" {
				v.array = append(v.array, child)
			} else {
				v.dict[key] = child
			}
		case xml.EndElement:
			if t.Name == start.Name {
				return nil
			}
		}
	}
}
