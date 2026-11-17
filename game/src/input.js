// Mosslight Courier — browser input.
//
// Keyboard (WASD / arrows, Space or Shift to dash, Enter, P/Escape, M, R) and
// pointer drag steering. main.js feeds canvas button presses into `button`
// and reads edge triggers via takePressed. The world simulation never sees
// this module; it only consumes the plain axis object built here.

const MOVE_KEYS = {
  w: 'up',
  a: 'left',
  s: 'down',
  d: 'right',
  arrowup: 'up',
  arrowleft: 'left',
  arrowdown: 'down',
  arrowright: 'right',
};

export function createInput() {
  const input = {
    keys: new Set(),
    pointer: { dragging: false, startX: 0, startY: 0, x: 0, y: 0 },
    button: { dash: false },
    pressed: { confirm: false, pause: false, mute: false, restart: false },
  };

  const onKeyDown = (e) => {
    const k = e.key.toLowerCase();
    if (MOVE_KEYS[k] || k === ' ') e.preventDefault();
    if (e.repeat) return;
    if (MOVE_KEYS[k]) input.keys.add(MOVE_KEYS[k]);
    else if (k === ' ' || k === 'shift') input.keys.add('dash');
    else if (k === 'enter') input.pressed.confirm = true;
    else if (k === 'p' || k === 'escape') {
      input.pressed.pause = true;
      e.preventDefault();
    } else if (k === 'm') input.pressed.mute = true;
    else if (k === 'r') input.pressed.restart = true;
  };

  const onKeyUp = (e) => {
    const k = e.key.toLowerCase();
    if (MOVE_KEYS[k]) input.keys.delete(MOVE_KEYS[k]);
    else if (k === ' ' || k === 'shift') input.keys.delete('dash');
  };

  const onBlur = () => resetInput(input);

  window.addEventListener('keydown', onKeyDown, { passive: false });
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);

  return input;
}

/** Clears every held key and drag, so controls never stick after a blur. */
export function resetInput(input) {
  input.keys.clear();
  input.pointer.dragging = false;
  input.button.dash = false;
}

/**
 * The movement axis for the simulation: drag steering wins when the pointer
 * is actively dragged beyond its dead zone, otherwise keys drive it.
 */
export function inputAxis(input) {
  if (input.pointer.dragging) {
    const dx = input.pointer.x - input.pointer.startX;
    const dy = input.pointer.y - input.pointer.startY;
    const px = Math.max(-1, Math.min(1, dx / 56));
    const py = Math.max(-1, Math.min(1, dy / 56));
    if (Math.hypot(px, py) > 0.18) return { x: px, y: py };
  }
  let x = 0;
  let y = 0;
  if (input.keys.has('left')) x -= 1;
  if (input.keys.has('right')) x += 1;
  if (input.keys.has('up')) y -= 1;
  if (input.keys.has('down')) y += 1;
  const len = Math.hypot(x, y);
  if (len > 1) {
    x /= len;
    y /= len;
  }
  return { x, y };
}

/** Dash is held (keyboard or on-screen button); the world gates the cooldown. */
export function inputDash(input) {
  return input.keys.has('dash') || input.button.dash;
}

/** Reads and clears one edge trigger (start / pause / mute / restart). */
export function takePressed(input, name) {
  const v = input.pressed[name];
  input.pressed[name] = false;
  return v;
}
