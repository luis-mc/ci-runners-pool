package tray

import (
	"bytes"
	"encoding/binary"
	"image"
	"image/color"
	"image/png"
)

const iconSize = 32

// IconPNG draws the icon of a state. Shapes differ, not only colour (R5.4):
// ok is a disc, waiting a diamond, failed a cross, stopped a framed cross, starting a triangle.
func IconPNG(s State) []byte {
	img := image.NewNRGBA(image.Rect(0, 0, iconSize, iconSize))
	ink := color.NRGBA{R: 0x20, G: 0x20, B: 0x20, A: 0xff}
	if s == StateHealthy {
		ink = color.NRGBA{R: 0x1a, G: 0x7f, B: 0x37, A: 0xff}
	}
	c := float64(iconSize-1) / 2
	for y := 0; y < iconSize; y++ {
		for x := 0; x < iconSize; x++ {
			dx, dy := float64(x)-c, float64(y)-c
			if inShape(s, dx, dy) {
				img.SetNRGBA(x, y, ink)
			}
		}
	}
	var b bytes.Buffer
	_ = png.Encode(&b, img)
	return b.Bytes()
}

func abs(f float64) float64 {
	if f < 0 {
		return -f
	}
	return f
}

func inShape(s State, dx, dy float64) bool {
	switch s {
	case StateHealthy:
		return dx*dx+dy*dy <= 14*14
	case StateWaiting:
		return abs(dx)+abs(dy) <= 15
	case StateFailed:
		return (abs(abs(dx)-abs(dy)) <= 2.5) && abs(dx) <= 13
	case StateStopped:
		frame := abs(dx) <= 15 && abs(dy) <= 15 && (abs(dx) >= 13 || abs(dy) >= 13)
		return frame || ((abs(abs(dx)-abs(dy)) <= 2) && abs(dx) <= 10)
	default: // starting: triangle pointing right
		return dx >= -10 && dx <= 12 && abs(dy) <= (12-dx)*0.6
	}
}

// IconICO wraps the PNG in an ICO container; Windows needs ICO for tray icons.
func IconICO(s State) []byte {
	p := IconPNG(s)
	var b bytes.Buffer
	_ = binary.Write(&b, binary.LittleEndian, [3]uint16{0, 1, 1})
	b.Write([]byte{iconSize, iconSize, 0, 0})
	_ = binary.Write(&b, binary.LittleEndian, [2]uint16{1, 32})
	_ = binary.Write(&b, binary.LittleEndian, uint32(len(p)))
	_ = binary.Write(&b, binary.LittleEndian, uint32(22))
	b.Write(p)
	return b.Bytes()
}

// Icon returns the bytes systray wants on this OS.
func Icon(s State) []byte {
	if runtimeGOOS() == "windows" {
		return IconICO(s)
	}
	return IconPNG(s)
}
