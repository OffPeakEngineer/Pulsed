//go:build !darwin

package main

func platformDisk(string) (diskIdentity, bool) { return diskIdentity{}, false }
