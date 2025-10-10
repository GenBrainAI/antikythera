# Antikythera Mechanism 3D Explorer

This project provides an interactive three-dimensional reconstruction of the Antikythera mechanism. The visualization is built with [three.js](https://threejs.org/) and is driven by gear metadata distilled from published reconstructions by Price (1974) and Freeth et al. (2006, 2014). It is designed as a foundation for future immersive (VR) exploration of the ancient computer.

## Features

- **Complete Gear System** – All surviving gears plus a full planetary system (Mercury, Venus, Mars, Jupiter, Saturn) based on the Freeth et al. (2021) reconstruction.
- **Solar System Visualization** - A dynamic 3D display of the Sun, Moon, and planets, with their orbits directly driven by the mechanism's gears.
- **Interactive 3D scene** – Orbit, pan, and zoom around the mechanism. Highlight individual gears, filter by gear train, and display annotations for each axis.
- **Front dial reconstruction** – Bronze front frame, zodiac/calendar dial texture, and live solar/lunar pointers keyed to the simulated gear train.
- **Mechanical simulation** – Procedural computation of gear ratios based on tooth counts and connection types, enabling live animation from the main drive gear through all linked trains.
- **Information overlay** – Inspect the function, historical notes, and specifications of every gear directly within the UI, with tooltips and focus controls.
- **VR-ready architecture** – Scene graph and controls are structured to allow straightforward integration with WebXR and immersive input devices in subsequent phases.

## Getting started

1. Open `index.html` in any modern browser with WebGL2 support.
2. Use the right-hand control panel to:
   - Play/pause the animation.
   - Set the animation speed using the time-based dropdown (e.g., "1 Day / sec").
   - Set the mechanism to a specific date using the date picker.
   - Highlight specific gear trains.
   - Focus on and inspect individual gears.
   - Toggle visibility of axis guides and tooth markers.
3. Orbit around the mechanism using the mouse/touchpad (drag to orbit, scroll to zoom, right-drag to pan).

> **Note:** The project uses ES modules from CDN (jsDelivr). Ensure you have an active internet connection when opening `index.html`.

## Project structure

```
index.html          # Application shell and UI layout
src/styles.css      # Control panel and layout styling
src/main.js         # Three.js scene, controls, interaction logic
src/gearFactory.js  # Procedural gear mesh generation
src/system.js       # Gear graph simulation and animation engine
src/data/gears.js   # Gear catalogue, axes, connections, and train metadata
```

## Extending toward VR

- Replace the OrbitControls usage with WebXR-compatible controls (e.g., `XRControllerModelFactory`) while keeping the gear system intact.
- Introduce immersive UI elements by projecting the current control panel into 3D space.
- Optimise procedural gear geometry (e.g., extruded involute teeth) for higher fidelity while balancing runtime performance.

## References

- Price, D. de Solla. *Gears from the Greeks*. Transactions of the American Philosophical Society, 1974.
- Freeth, T. et al. *Decoding the ancient Greek astronomical calculator known as the Antikythera Mechanism*. Nature, 2006.
- Freeth, T. et al. *Calendars with Olympiad display and eclipse prediction on the Antikythera Mechanism*. Nature, 2014.
