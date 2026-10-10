CHANGES
=======
Version 0.2.0 - 2026-10-XX
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
