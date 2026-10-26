// ─── Sons du jeu (mêmes timbres que le site, pré-rendus en WAV) + vibrations ──
import { createAudioPlayer, type AudioPlayer } from "expo-audio";
import * as Haptics from "expo-haptics";

const SOURCES = {
  deal: require("../../assets/sounds/deal.wav"),
  flip: require("../../assets/sounds/flip.wav"),
  chip: require("../../assets/sounds/chip.wav"),
  win: require("../../assets/sounds/win.wav"),
  lose: require("../../assets/sounds/lose.wav"),
  nioufi: require("../../assets/sounds/nioufi.wav"),
};
const VOLUMES: Record<keyof typeof SOURCES, number> = {
  deal: 0.35, flip: 0.5, chip: 0.4, win: 0.6, lose: 0.5, nioufi: 0.75,
};

let muted = false;
const players: Partial<Record<keyof typeof SOURCES, AudioPlayer>> = {};

function play(name: keyof typeof SOURCES) {
  if (muted) return;
  try {
    let p = players[name];
    if (!p) {
      p = createAudioPlayer(SOURCES[name]);
      p.volume = VOLUMES[name];
      players[name] = p;
    }
    p.seekTo(0).catch(() => {});
    p.play();
  } catch {
    /* le son ne doit jamais casser le jeu */
  }
}

const buzz = (fn: () => Promise<void>) => { fn().catch(() => {}); };

export function setMuted(m: boolean) { muted = m; }
export function isMuted() { return muted; }

export const sfxDeal = () => play("deal");
export const sfxFlip = () => { play("flip"); buzz(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)); };
export const sfxChip = () => { play("chip"); buzz(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)); };
export const sfxWin = () => { play("win"); buzz(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)); };
export const sfxLose = () => { play("lose"); buzz(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)); };
export const sfxNioufi = () => { play("nioufi"); buzz(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)); };
export const tapFeedback = () => buzz(() => Haptics.selectionAsync());
