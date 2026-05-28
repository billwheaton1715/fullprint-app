import Unit from './Unit';

describe('Unit enum', () => {
  it('contains MM, INCH, and PX', () => {
    expect(Unit.MM).toBe('MM');
    expect(Unit.INCH).toBe('INCH');
    expect(Unit.PX).toBe('PX');
  });
});
