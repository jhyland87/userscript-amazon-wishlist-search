// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { el } from '../src/dom';
import { GM } from './gm-stub';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('el', () => {
  it('sets id, class, title, attributes, dataset and styles', () => {
    const node = el('span', {
      id: 'badge',
      className: 'a b',
      title: 'Tip',
      attrs: { role: 'button', 'aria-label': 'Tip' },
      dataset: { state: 'added' },
      style: { color: 'red' },
    });
    expect(node.id).toBe('badge');
    expect(node.className).toBe('a b');
    expect(node.title).toBe('Tip');
    expect(node.getAttribute('role')).toBe('button');
    expect(node.getAttribute('aria-label')).toBe('Tip');
    expect(node.dataset.state).toBe('added');
    expect(node.style.color).toBe('red');
  });

  it('sets text as text, never as markup', () => {
    const node = el('span', { text: '<img src=x onerror=alert(1)>' });
    expect(node.querySelector('img')).toBeNull();
    expect(node.textContent).toBe('<img src=x onerror=alert(1)>');
  });

  it('appends children in order and wires listeners', () => {
    const onClick = vi.fn();
    const node = el('div', { on: { click: onClick } }, 'a', el('b', { text: 'b' }), 'c');
    expect(node.innerHTML).toBe('a<b>b</b>c');
    node.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('returns a detached element for the caller to place', () => {
    expect(el('div').isConnected).toBe(false);
  });

  it('fails loudly if the manager returns a Promise instead of an element', () => {
    // The API's type allows a Promise; no current manager returns one.
    vi.spyOn(GM, 'addElement').mockReturnValue(
      Promise.resolve(document.createElement('div')) as unknown as HTMLElement,
    );
    expect(() => el('div')).toThrow(/returned a Promise for <div>/);
  });
});
