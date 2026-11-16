export type InputState = {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  rollLeft: boolean;
  rollRight: boolean;
  brake: boolean;
};

export function createInputManager(
  canvas: HTMLCanvasElement,
  onEscape?: () => void
) {
  const state: InputState = {
    forward: false,
    back: false,
    left: false,
    right: false,
    up: false,
    down: false,
    rollLeft: false,
    rollRight: false,
    brake: false,
  };

  const onKeyDown = (e: KeyboardEvent) => {
    switch (e.code) {
      case 'KeyW': state.forward = true; break;
      case 'KeyS': state.back = true; break;
      case 'KeyA': state.left = true; break;
      case 'KeyD': state.right = true; break;
      case 'KeyR': state.up = true; break;
      case 'KeyF': state.down = true; break;
      case 'KeyQ': state.rollLeft = true; break;
      case 'KeyE': state.rollRight = true; break;
      case 'Space': state.brake = true; e.preventDefault(); break;
      case 'Escape':
        if (document.pointerLockElement) document.exitPointerLock();
        onEscape?.();
        break;
    }
  };
  const onKeyUp = (e: KeyboardEvent) => {
    switch (e.code) {
      case 'KeyW': state.forward = false; break;
      case 'KeyS': state.back = false; break;
      case 'KeyA': state.left = false; break;
      case 'KeyD': state.right = false; break;
      case 'KeyR': state.up = false; break;
      case 'KeyF': state.down = false; break;
      case 'KeyQ': state.rollLeft = false; break;
      case 'KeyE': state.rollRight = false; break;
      case 'Space': state.brake = false; break;
    }
  };
  const onClick = () => {
    canvas.requestPointerLock?.();
  };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('click', onClick);

  return {
    getState: () => ({ ...state }),
    dispose: () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('click', onClick);
    },
  };
}
