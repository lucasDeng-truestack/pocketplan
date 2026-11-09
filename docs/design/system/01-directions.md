# Directions

Four directions were explored on the dashboard and Quick add sheet, each in light and dark. The Directions card renders all eight side by side from one markup. Every direction keeps the same token names; a direction is a set of values plus a radius base and font families.

## All four ship, chosen per profile

Every direction is a theme the person picks on the Profile page (see the ProfileScreen card), together with an appearance of System, Light or Dark. The DirectionsDesktop and DirectionsTablet cards show the Dashboard in all four at 1280 and 834 so each can be judged where it is hardest. Because every direction ships, each one must pass the same quality bar: the contrast checks in the Quality checklist cover all eight themes, and every component card switches direction with the page's theme picker.

## Default: Modern

New accounts start on Modern. It is the direction the build already ships; its neutral stone chrome lets the eight envelope colours do all the identifying; and Geist with tabular figures makes amounts the clearest thing on the screen, which is the brief's second goal. What the other three cost, which is why they are choices rather than the default:

- Retro is the most charming and the best fit for the report email (which uses its palette regardless). In the app, gold rules on cream cut contrast on chips and inputs, and a monospace amount face is wider, so long balances wrap sooner on a 390px phone.
- Pixel is distinctive but a pixel display font at the size an amount needs is slow to read, and square 2px borders make 44px chips look heavier than the "three seconds" flow wants.
- Premium is the quietest and photographs well, but a high-contrast serif for amounts loses tabular alignment in most faces and reads as a statement, not a wallet.

## Modern

Clean fintech. Stone neutrals from the current build, Geist for everything, 0.5rem base radius, hairline borders, quiet shadows, no texture. Envelope colours exactly as in code. Light: `background` #fafaf9, `foreground` #1c1917, `primary` #292524. Dark: `background` #0c0a09, `foreground` #f5f5f4, `primary` #f5f5f4.

## Retro

A 1970s ledger. Cream paper `#faf7f2`, brown ink `#4a3b2f`, gold rules `#c9a96e` as `border`, a fine grain on the page, ruled rows inside cards. Fraunces for headings (`retro-heading`), IBM Plex Mono for amounts (`retro-mono`), base radius 0.25rem. Envelope slots remapped to earthy tones: `#b5654a` `#a98648` `#6a8a66` `#4f5467` `#6f8a4a` `#9a4a44` `#857a9a` `#5d8494`. Dark: `#211a14` ground, `#f1e8da` ink, `#e8d6b4` primary.

## Pixel

A tidy 8-bit wallet. Square corners (every radius 0), 2px hard `border` in `foreground`, stepped shadows (`2px 2px 0`, `4px 4px 0`), dotted dividers. Press Start 2P (`pixel-display`) for headings and the two large amount styles only; body and inputs stay in `sans`. Flat saturated fills: `#d62828` `#c25f00` `#06a77d` `#1d3557` `#2d6a4f` `#b5179e` `#7209b7` `#0096c7`. Light ground `#f2f2ee`, primary `#2b3a8f`. Dark ground `#121214`, primary `#8fb3ff`, dark envelope slots lightened so each is at least 3:1 on the card.

## Premium

Private banking. Ivory `#f6f3ec` or near-black `#0f0e0c` surfaces, Instrument Serif (`premium-serif`) for `amount-xl` and `amount-lg`, a one-pixel metallic rule (`ring`, #a08a5a light, #b8a068 dark) across the top of each card, no shadows, 0.375rem base radius. Desaturated jewel envelope slots: `#a35a4c` `#9a7f4e` `#5d8a7a` `#3f4663` `#5e7a4f` `#8a3f45` `#6e5f8e` `#4f7a8a`. Dark primary is gold `#d8c08a` with near-black text.

## How a chosen theme is applied

Set `data-theme` to the theme id (`modern-light`, `retro-dark`, and so on) on the `html` element. In the app, `globals.css` grows one block per theme id holding the same token names with that direction's values, plus its radius base and heading and amount font families; the server renders the attribute from the profile so the first paint is themed, and with appearance System the client resolves light or dark from `prefers-color-scheme`. Only the fonts a direction uses are loaded (Geist for all; Fraunces and IBM Plex Mono for Retro; Press Start 2P for Pixel; Instrument Serif for Premium). To preview a direction here, set the same attribute on any wrapper.
