CHANGES
=======
Version 0.5.0 - 2026-10-19
------------------
The site in Spanish and Basque (Euskara), as well as English.

- A language picker at the right of the navigation bar (inside the menu on
  phones) switches every page, the ship designer and the game's HUD.
- The first visit picks the browser's language when it is one of the three,
  English otherwise; the choice is remembered in the browser.
- Messages from the server (login and save errors, game errors, the default
  guest name) come in the chosen language too. Needs ships-go-3d 0.5.0; an
  older server answers in English.
- New ships start with a layer named in the chosen language ("Casco",
  "Kaskoa"); existing ships keep their layer names.
- The designer's textures and image links from 0.4.0 are translated too.

Version 0.4.1 - 2026-10-19
------------------
Space dust now surrounds the ship wherever it flies. Before, the dust stayed
in a small cloud at the centre of the world, so away from the centre there
was nothing passing by to show how fast the ship was moving.

Version 0.4.0 - 2026-10-19
------------------
Textures for ship parts in the designer.

- Each part can have one of eight built-in textures: hull panels, tiles,
  hazard stripes, carbon fibre, honeycomb, worn metal, camouflage and
  windows, picked from a row of previews under the part's color. "Plain"
  (the first one) is the old untextured look, and ships saved before keep it.
- The texture is tinted by the part's color, so color works as before.
- A new part gets the last texture picked, like it gets the last color.
- Or an image from the web: paste an https link to an image in "Image link"
  and it is tiled over the part like the built-in textures (pick white to
  show the image's own colors). The site hosting it has to allow other sites
  to use its images (CORS); if it doesn't, or the link breaks, the part
  shows plain, and the editor says the image couldn't be loaded. Every
  player's browser loads the image from that site in game.
- Textures are projected along each face, so they keep the same size on
  every shape however much a part is stretched, and show in thumbnails and
  in game too. They are drawn in the browser, so nothing extra is
  downloaded.

Needs ships-go-3d 0.4.0, which saves the texture with the ship.

Version 0.3.0 - 2026-10-18
------------------
Six new shapes in the ship designer, for more detailed ships.

- Dome (half sphere) for cockpits and turrets.
- Capsule (cylinder with rounded ends) for engines and fuel pods.
- Pyramid for noses and spikes.
- Tube (hollow cylinder) for thrusters and gun barrels.
- Hex prism for armour plates and details.
- Tapered cylinder for engine nozzles.

Like the other shapes, each fits a unit cube and can be mirrored. Needs
ships-go-3d 0.3.0, which accepts the new shapes when a ship is saved.

Clearer axes
- The X, Y and Z fields for position, rotation and size are colored red,
  green and blue, with a colored X / Y / Z header above them.
- The editor draws the X (red), Y (green) and Z (blue) axes in the same
  colors, matching the move/rotate/scale gizmo, so it's clear which field
  moves a part which way. The front arrow is the same blue as Z.

Version 0.2.0 - 2026-10-10
------------------
A 3D sphere radar, and the game made playable on phones: steer with an
on-screen stick or by tilting the phone, and switch between the two at any
time.

Radar
- A radar sphere in the bottom-right corner shows every enemy around you in
  3D. It turns with your ship, so ahead is always the same way on the radar,
  and each blip has a stalk down to the radar's equator, so you can tell at a
  glance whether an enemy is above or below you. Enemies beyond range are
  pinned to the surface, dimmed. `+` and `-` change the range (300, 600, 1200
  or 2400 units).
- It is drawn by the game's own renderer into a corner of the canvas, not a
  second WebGL context, so it stays cheap on phones.
- Tapping or clicking its caption cycles the range too.

Phones
- On a touch screen the game shows on-screen controls: a throttle slider on
  the left edge (it sets the speed to hold, including reverse), fire and
  roll buttons on the right, plus buttons to switch steering mode, show the
  scores and go full screen. The radar moves to the top right, out of the
  way of the thumbs.
- Two ways to steer, switchable in game or before launching (the choice is
  remembered): an on-screen stick, or tilting the phone. Tilt is relative to
  how the phone is held when it starts, with a Recenter button, a small dead
  zone and full turn rate at 25 degrees; it works in portrait and either
  landscape. Speed always stays on the slider, since tilting can't set it.
- Launching on a phone goes full screen (and locks landscape where the
  browser allows it). On iOS the motion-sensor permission is asked for on
  the Launch tap; if it is refused, or a device sends no sensor readings,
  the game falls back to the stick and says so.

Bugfixes
- Position updates are no longer queued while the connection is backed up
  (a stalled mobile network): they are snapshots, each replacing the last,
  and the queued pile used to arrive all at once and trip the server's flood
  protection, disconnecting phone players within seconds.
- "Could not reach the server" now explains the usual cause on the home
  server - a certificate the browser doesn't trust for the address the site
  was opened at, e.g. by IP - with a link to open the API and accept it. The
  game likewise says "Could not connect" instead of "Disconnected" when it
  never got in.

Version 0.1.0 - 2026-10-09
------------------
First version: the web client of Ships 3D. Design a spaceship from 3D parts,
then fly it against other players in open space.

- Accounts shared with the 2D game: register, log in, log out, change
  password.
- My ships: thumbnails of every design, edit, delete.
- 3D editor: layers of primitives (box, sphere, cylinder, cone, wedge, ring),
  move/rotate/scale gizmo with snapping, numeric properties, colors, left/right
  mirroring, undo/redo, keyboard shortcuts, unsaved-changes guard. Works on
  narrow screens too.
- Game: arcade 6-degrees-of-freedom flight with keyboard and mouse, chase
  camera, bullets, kills and respawns, scoreboard, kill feed, and markers
  pointing to every enemy. Guests can play with the built-in ships.
