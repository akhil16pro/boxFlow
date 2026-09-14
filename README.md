# Box Flow

Box Flow is a small, playful physics sandbox. Build conveyor belts and pneumatic tubes, drop boxes onto the stage, and watch them move, stack, ride belts, and travel through pipes.

The whole game is static HTML, CSS, and JavaScript — there is no build step or backend.

## Run locally

Open `index.html` directly, or serve the folder with any static file server:

```bash
python3 -m http.server 4173 --bind 0.0.0.0
```

Then open:

```text
http://localhost:4173
```

To let others on the same network play, share your machine’s LAN address, for example:

```text
http://192.168.0.22:4173
```

## Controls

### Mouse

- **Select** — click a part to select it; drag to move belts and boxes.
- **Belt** — click to place a conveyor belt.
- **Tube** — click and drag to draw a pipe. Clicking the last tile of an existing tube and dragging extends that tube.
- **Box** — click to drop a box.
- **Delete** — click a part, or right-click anything on the canvas, to remove it.
- Selected tubes show floating controls: direction arrows, remove-last-segment, and a **Move** toggle. Arrows can be press-and-held to keep extending the tube.

### Keyboard

| Key | Action |
|---|---|
| `V` | Select tool |
| `B` | Belt tool |
| `T` | Tube tool |
| `X` | Box tool |
| `D` | Delete tool |
| `Esc` | Select tool / cancel tube drawing |
| `Del` / `Backspace` | Remove selected part |
| `M` | Toggle sound |
| `H` / `?` | Help |
| `Cmd/Ctrl+S` | Export layout JSON |

## Saving and sharing layouts

Layouts autosave in the browser’s local storage. Use **Export** to download a JSON file and **Import** to load one. Each browser keeps its own layout; exports are useful for sharing a specific factory setup.

The default startup layout is loaded from `js/template-layout.json`. If no autosave exists, the game seeds that layout automatically.

## Project structure

```text
index.html             Page shell, toolbar, modals, script loading
styles.css             Visual design and layout
js/main.js             Bootstrap, resize handling, game loop
js/world.js            Entities, physics, save/load, default scene
js/renderer.js         Canvas rendering
js/input.js            Pointer, keyboard, chips, tube drawing
js/ui.js               Toolbar, modals, import/export
js/demo-layout.js      Built-in fallback starter layout
js/template-layout.json Optional JSON template loaded on startup
js/audio.js            WebAudio sound effects
js/utils.js            Shared helpers
```

## Notes

- Physics uses a fixed timestep so movement stays consistent across frame rates.
- Sound is synthesized with WebAudio; no audio files are required.
- The project is intentionally dependency-free.
