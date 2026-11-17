package repos

import (
	"errors"
	"strings"
	"testing"
)

func TestParityAddress(t *testing.T) { // github-integration R5.84, CRSP141
	cases := []struct {
		name, public, listen, want, setting string
	}{
		{"join URL: public host and console port, https", "pool.lan", "0.0.0.0:8460", "https://pool.lan:8460", ""},
		{"port from the listen address", "pool.lan", "10.0.0.5:9443", "https://pool.lan:9443", ""},
		{"public ip", "10.0.0.5", ":8460", "https://10.0.0.5:8460", ""},
		{"ipv6 is bracketed", "fd00::5", "[::]:8460", "https://[fd00::5]:8460", ""},
		{"no port in listen takes the default", "pool.lan", "0.0.0.0", "https://pool.lan:8460", ""},
		{"loopback listen refused", "pool.lan", "127.0.0.1:8460", "", SettingListenAddr},
		{"ipv6 loopback listen refused", "pool.lan", "[::1]:8460", "", SettingListenAddr},
		{"localhost listen refused", "pool.lan", "localhost:8460", "", SettingListenAddr},
		{"no public host refused", "", "0.0.0.0:8460", "", SettingPublicHost},
		{"loopback public host refused", "127.0.0.1", "0.0.0.0:8460", "", SettingPublicHost},
		{"localhost public host refused", "localhost", "0.0.0.0:8460", "", SettingPublicHost},
		{"wildcard public host refused", "0.0.0.0", "0.0.0.0:8460", "", SettingPublicHost},
		{"scheme in the host refused", "http://pool.lan", "0.0.0.0:8460", "", SettingPublicHost},
		{"port in the host refused", "pool.lan:8460", "0.0.0.0:8460", "", SettingPublicHost},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got, err := ParityAddress(c.public, c.listen)
			if c.setting == "" {
				if err != nil || got != c.want {
					t.Fatalf("got %q, %v; want %q", got, err, c.want)
				}
				if !strings.HasPrefix(got, "https://") {
					t.Fatalf("not https: %q", got)
				}
				return
			}
			var ae *AddressError
			if !errors.As(err, &ae) || ae.Setting != c.setting || got != "" {
				t.Fatalf("got %q, %v; want a refusal naming %s", got, err, c.setting)
			}
			// The listen address is chosen in the console (operations R5.90), so its
			// reason names the place; the public host is still a setting.
			want := c.setting
			if c.setting == SettingListenAddr {
				want = "Settings, Console, Network"
			}
			if !strings.Contains(ae.Reason, want) {
				t.Fatalf("the reason does not name %q: %q", want, ae.Reason)
			}
		})
	}
}
