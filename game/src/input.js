// Keyboard and mouse input, plus a synthetic input source the screenshot autopilot drives.
// The game only ever reads through this object, so a staged scene and a real player agree.

export function createInput() {
  const keys = new Set();
  const input = {
    keys,
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
    clicked: false,
    // Synthetic overrides used by the screenshot autopilot; null means "use the real keys".
    synth: null,
    isDown(code) {
      if (this.synth && this.synth.keys) return this.synth.keys.has(code);
      return keys.has(code);
    },
    axis() {
      // -1..1 on each axis from WASD / arrows.
      let x = 0;
      let y = 0;
      if (this.isDown('KeyA') || this.isDown('ArrowLeft')) x -= 1;
      if (this.isDown('KeyD') || this.isDown('ArrowRight')) x += 1;
      if (this.isDown('KeyW') || this.isDown('ArrowUp')) y -= 1;
      if (this.isDown('KeyS') || this.isDown('ArrowDown')) y += 1;
      return { x, y };
    },
    attach(canvas) {
      window.addEventListener('keydown', (event) => {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
          event.preventDefault();
        }
        keys.add(event.code);
        if (event.code === 'KeyE' || event.code === 'KeyF' || event.code === 'KeyM' || event.code === 'Enter' || event.code === 'Escape' || event.code === 'KeyP') {
          input.pressed = event.code;
        }
      });
      window.addEventListener('keyup', (event) => keys.delete(event.code));
      window.addEventListener('blur', () => keys.clear());
      canvas.addEventListener('mousemove', (event) => {
        const rect = canvas.getBoundingClientRect();
        input.mouseX = event.clientX - rect.left;
        input.mouseY = event.clientY - rect.top;
      });
      canvas.addEventListener('mousedown', (event) => {
        if (event.button === 0) {
          input.mouseDown = true;
          input.clicked = true;
        }
      });
      window.addEventListener('mouseup', (event) => {
        if (event.button === 0) input.mouseDown = false;
      });
    },
    /** Consume one-shot presses (E, F, M, Enter, Escape, P, click) each frame. */
    consume() {
      const pressed = this.pressed || null;
      const clicked = this.clicked;
      this.pressed = null;
      this.clicked = false;
      return { pressed, clicked };
    },
  };
  input.pressed = null;
  return input;
}
