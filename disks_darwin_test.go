package main

import (
	"encoding/xml"
	"testing"
)

func TestAPFSPlist(t *testing.T) {
	var root plistValue
	err := xml.Unmarshal([]byte(`<?xml version="1.0"?><plist version="1.0"><dict><key>Containers</key><array><dict><key>ContainerReference</key><string>disk3</string><key>PhysicalStores</key><array><dict><key>DeviceIdentifier</key><string>disk0s2</string></dict></array><key>Volumes</key><array><dict><key>DeviceIdentifier</key><string>disk3s1</string><key>CapacityInUse</key><integer>1000</integer><key>Encrypted</key><false/></dict></array></dict></array></dict></plist>`), &root)
	if err != nil {
		t.Fatal(err)
	}
	container := root.dict["Containers"].array[0]
	if container.dict["ContainerReference"].text != "disk3" || container.dict["PhysicalStores"].array[0].dict["DeviceIdentifier"].text != "disk0s2" || container.dict["Volumes"].array[0].dict["DeviceIdentifier"].text != "disk3s1" {
		t.Fatalf("unexpected plist: %+v", root)
	}
	if got := macSnapshot.ReplaceAllString("/dev/disk3s1s1", "$1"); got != "/dev/disk3s1" {
		t.Fatal(got)
	}
}
