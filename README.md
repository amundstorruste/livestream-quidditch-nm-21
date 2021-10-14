## livestream-quidditch-nm-21

# For å starte visningen en kamp.

1. Få timekeeper til å sette på quidditch.live og under Connectivity aktivere `Transmit live game data`
2. Skriv ned `Public Game ID`. Den trengs i steg 8.
3. I Open Broadcaster Software velg `Score overlay` eller `Score overlay (switch-sides)`
4. Manuelt resett tekstfilene `gametime` til 00:00, og `scoreA` og `scoreB` til 0.
5. I Open Broadcaster Software dobbeltklikk på `logoA` og `logoB` og velg riktig logo for hvert av lagene.
6. Åpne mappen quidditchlive_api, høyreklikk, velg `Open in Bash` for å åpne terminalen.
7. Skriv `node quidditchlive_api.js`
8. Når `Public Game ID?` dukker opp, skriv inn og trykk enter

Nå skal alt funke som det skal og score skal oppdateres og vises av seg selv.

# For å starte waiting overlay

1. Velg `Waiting overlay`
2. Endre `LogoA` og `LogoB` ved å dobbelklikke og velge riktig logo fra mappen bilder/logo
3. Endre `TeamA`, `TeamA`, `Description` ved å dobbeltklikke på dem og skrive inn noe annet manuelt.

Den kan stå sånn frem til neste kamp.

# For å hente inn video

1. Telefonen som sender video åpner linken:
   https://vdo.ninja/?push=tcNCAWs&quality=0&label=NM_21_video

2. Start Electron Capture fra skrivebordet.
3. Velg følgende link:
   https://vdo.ninja/?view=tcNCAWs&bitrate=5000&label=NM_21_video
4. Velg `Default - Speakers (Realtek(R) Audio)` (ikke så farlig bare ikke velg kanalen til kommentatorene se under)
5. Høyreklikk og resize window til 1920x1080 hvis dette ikke er gjort

# For å hente inn lyd

1. Hent video først (idk om det breaker hvis ikke)
2. Telefonen som sender audio åpner linker:
   https://vdo.ninja/?push=pFCzmgL&stereo&audiodevice=1&audiodevice=1&label=NM21_commentary_and_sound

3. Start Electron capture fra skrivebordet.
4. Velg følgende link:
   https://vdo.ninja/?view=pFCzmgL&stereo&label=NM21_commentary_and_sound
5. Velg `CABLE Input (VB-Audio Virtual Cable)`

# In case of fuckup

1. Hør med Stein eller Amund
2. Skru av stream få den som styrer kamera til å filme istedenfor å streame.
