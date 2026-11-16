package repos

import (
	"net"
	"strings"
)

// Settings the owner fixes when the controller has no address a runner can
// reach (CRSP141). They are named in the answer so the console can say them.
const (
	SettingPublicHost = "CRSP_PUBLIC_HOST"
	SettingListenAddr = "CRSP_LISTEN_ADDR"
)

// defaultConsolePort is the console port when the listen address has none.
const defaultConsolePort = "8460"

// AddressError says why the controller has no address a runner can reach, and
// which setting to fix.
type AddressError struct {
	Setting string
	Reason  string
}

func (e *AddressError) Error() string { return e.Reason }

// ParityAddress is the address the parity workflow calls the controller at: the
// address machines use to join (the console address of the join file, https,
// served with the controller CA), built from the public host and the console
// port. A job runs on a self-hosted runner that is often a container or another
// machine, so a loopback or http address is never returned. With no such
// address it returns an *AddressError that names the setting to fix.
func ParityAddress(publicHost, listenAddr string) (string, error) {
	port := defaultConsolePort
	if h, p, err := net.SplitHostPort(strings.TrimSpace(listenAddr)); err == nil {
		if p != "" {
			port = p
		}
		if isLoopbackHost(h) {
			return "", &AddressError{Setting: SettingListenAddr, Reason: "the console listens on a loopback address (" + listenAddr + "), which only this machine can reach; set " + SettingListenAddr + " to an address of this machine that the runners can reach"}
		}
	}
	host := strings.TrimSpace(publicHost)
	switch {
	case host == "":
		return "", &AddressError{Setting: SettingPublicHost, Reason: "no public host name is set for this controller; set " + SettingPublicHost + " to the name or address the runners and machines reach it at"}
	case strings.ContainsAny(host, "/@ ") || strings.Contains(host, "://") || net.ParseIP(strings.Trim(host, "[]")) == nil && strings.Contains(host, ":"):
		return "", &AddressError{Setting: SettingPublicHost, Reason: SettingPublicHost + " must be a host name or address only, with no scheme, port or path"}
	case isLoopbackHost(host) || isWildcardHost(host):
		return "", &AddressError{Setting: SettingPublicHost, Reason: SettingPublicHost + " is " + host + ", which a runner on another machine or in a container cannot reach; set it to the name or address the runners reach this controller at"}
	}
	return "https://" + net.JoinHostPort(strings.Trim(host, "[]"), port), nil
}

func isLoopbackHost(h string) bool {
	h = strings.Trim(strings.ToLower(strings.TrimSpace(h)), "[]")
	if h == "localhost" || strings.HasSuffix(h, ".localhost") {
		return true
	}
	ip := net.ParseIP(h)
	return ip != nil && ip.IsLoopback()
}

func isWildcardHost(h string) bool {
	ip := net.ParseIP(strings.Trim(strings.TrimSpace(h), "[]"))
	return ip != nil && ip.IsUnspecified()
}
