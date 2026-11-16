import { describe, expect, it } from 'vitest';
import { modeToState } from '../src/core/permissions';
import { chmodDirectoryFindCommand, chmodOctalCommand, chmodSymbolicArg, chmodSymbolicCommand } from '../src/core/commands';

describe('commands output (AT-13, AT-14)', () => {
  it('AT-13: Mode 755 file path deploy.sh -> chmod 755 deploy.sh', () => {
    const s = modeToState(0o755, 'file');
    expect(chmodOctalCommand(s, 'deploy.sh')).toBe('chmod 755 deploy.sh');
  });

  it('AT-14: Mode 775 directory -> find line shown', () => {
    const s = modeToState(0o775, 'directory');
    expect(chmodDirectoryFindCommand(s, 'project')).toBe('find project -type d -exec chmod 775 {} \\;');
  });

  it('Symbolic arg form includes special bits', () => {
    const s = modeToState(0o4755, 'file');
    expect(chmodSymbolicArg(s)).toContain('u=');
    expect(chmodSymbolicCommand(s, 'bin')).toContain('chmod');
  });

  it('Four-digit octal used when special bits set', () => {
    const s = modeToState(0o4755, 'file');
    expect(chmodOctalCommand(s, 'bin')).toBe('chmod 4755 bin');
  });
});
