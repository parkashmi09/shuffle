// stake: hash's pages/Sports/sportArt.js lookup — BetBy's sport/chrome SVGs, copied to assets/exchange-sports.
const art = import.meta.glob('../../assets/exchange-sports/*.svg', { eager: true, query: '?raw', import: 'default' });
const at = (file) => art[`../../assets/exchange-sports/${file}.svg`];

export const sportArt = (sport) => (sport ? at(`sport-${sport}`) : undefined);
export const hasSportIcon = (sport) => Boolean(sportArt(sport));
export const chromeArt = (name) => (name ? at(name) : undefined);
