import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Graphene from 'gi://Graphene';
import Pango from 'gi://Pango';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const ART_SMALL = 26;
const ART_BIG = 56;
const BAR_W = 170;
const SCRUBBER_W = 140;

// padding is [top, right, bottom, left]
const COMPACT = {radius: 18, padding: [5, 14, 5, 5], artSize: ART_SMALL, artRadius: ART_SMALL / 2};
const EXPANDED = {radius: 30, padding: [12, 16, 12, 12], artSize: ART_BIG, artRadius: 14};

// Damped spring (response 0.45s, damping 0.78 → ~2% overshoot), t in seconds → progress
const OMEGA = 2 * Math.PI / 0.45;
const ZETA = 0.78;
const OMEGA_D = OMEGA * Math.sqrt(1 - ZETA * ZETA);
const spring = t => 1 - Math.exp(-ZETA * OMEGA * t) * (Math.cos(OMEGA_D * t) + ZETA * OMEGA / OMEGA_D * Math.sin(OMEGA_D * t));
const lerp = (a, b, p) => a + (b - a) * p;

const toGicon = icon => typeof icon === 'string' ? new Gio.ThemedIcon({name: icon}) : icon;

export const Island = GObject.registerClass(
class Island extends St.BoxLayout {
    _init(settings) {
        super._init({
            style_class: 'di-island',
            reactive: true,
            track_hover: true,
            visible: false,
            clip_to_allocation: true,
            pivot_point: new Graphene.Point({x: 0.5, y: 0.5}),
        });
        this._settings = settings;
        this._player = null;
        this._hasMusic = false;
        this._expanded = false;
        this._shown = false;
        this._trackKey = null;
        this._indicators = new Map();
        this._toastActive = false;
        this._toastId = 0;
        this._peekActive = false;
        this._peekId = 0;
        this._peekCallback = null;
        this._hoverId = 0;
        this._progressId = 0;
        this._timeline = null;
        this._layout = COMPACT;
        this._geometry = COMPACT;
        this._artBackground = '';
        this._artCancellable = new Gio.Cancellable();

        // Album Art
        this._art = new St.Bin({style_class: 'di-art', pivot_point: new Graphene.Point({x: 0.5, y: 0.5})});
        this.add_child(this._art);

        // Text & Scrubber Container
        this._text = new St.BoxLayout({style_class: 'di-text', vertical: true, y_align: Clutter.ActorAlign.CENTER});
        this._title = new St.Label({style_class: 'di-title'});
        this._artist = new St.Label({style_class: 'di-artist', visible: false});
        this._title.clutter_text.ellipsize = Pango.EllipsizeMode.END;
        this._artist.clutter_text.ellipsize = Pango.EllipsizeMode.END;
        this._text.add_child(this._title);
        this._text.add_child(this._artist);

        // Media Scrubber Bar (Expanded mode)
        this._scrubberBox = new St.BoxLayout({style_class: 'di-media-scrubber', visible: false, y_align: Clutter.ActorAlign.CENTER});
        this._timeCurrent = new St.Label({style_class: 'di-time-label', text: '0:00'});
        this._scrubberBar = new St.Widget({
            style_class: 'di-scrubber-bar',
            width: SCRUBBER_W,
            y_align: Clutter.ActorAlign.CENTER,
            layout_manager: new Clutter.BinLayout(),
        });
        this._scrubberFill = new St.Widget({style_class: 'di-scrubber-fill', width: 0});
        this._scrubberBar.add_child(this._scrubberFill);
        this._timeTotal = new St.Label({style_class: 'di-time-label', text: '0:00'});
        this._scrubberBox.add_child(this._timeCurrent);
        this._scrubberBox.add_child(this._scrubberBar);
        this._scrubberBox.add_child(this._timeTotal);
        this._text.add_child(this._scrubberBox);

        this.add_child(this._text);

        // EQ Visualizer Bars
        this._eq = new St.BoxLayout({style_class: 'di-eq', y_align: Clutter.ActorAlign.CENTER});
        for (let i = 0; i < 4; i++)
            this._eq.add_child(new St.Widget({style_class: 'di-bar', height: 3, y_align: Clutter.ActorAlign.CENTER}));
        this.add_child(this._eq);

        // Media Player Controls
        this._controls = new St.BoxLayout({visible: false, y_align: Clutter.ActorAlign.CENTER});
        this._controls.add_child(this._button('media-skip-backward-symbolic', () => this._player?.previous()));
        this._playButton = this._button('media-playback-pause-symbolic', () => this._player?.playPause());
        this._controls.add_child(this._playButton);
        this._controls.add_child(this._button('media-skip-forward-symbolic', () => this._player?.next()));
        this.add_child(this._controls);

        // Persistent Indicators (System monitor, battery, bluetooth, etc.)
        this._indicatorBox = new St.BoxLayout({style_class: 'di-indicators', visible: false, y_align: Clutter.ActorAlign.CENTER});
        this.add_child(this._indicatorBox);

        // Toast Messages (Volume, Brightness, Charger)
        this._toastBox = new St.BoxLayout({style_class: 'di-toast', visible: false, y_align: Clutter.ActorAlign.CENTER});
        this._toastIcon = new St.Icon({style_class: 'di-toast-icon'});
        this._toastBar = new St.Widget({
            style_class: 'di-level',
            width: BAR_W,
            y_align: Clutter.ActorAlign.CENTER,
            layout_manager: new Clutter.BinLayout(),
        });
        this._toastFill = new St.Widget({style_class: 'di-level-fill', width: 0});
        this._toastBar.add_child(this._toastFill);
        this._toastLabel = new St.Label({style_class: 'di-toast-label', y_align: Clutter.ActorAlign.CENTER});
        this._toastLabel.clutter_text.ellipsize = Pango.EllipsizeMode.END;
        this._toastBox.add_child(this._toastIcon);
        this._toastBox.add_child(this._toastBar);
        this._toastBox.add_child(this._toastLabel);
        this.add_child(this._toastBox);

        // Notification Peek Box (NotchNux Style)
        this._peekBox = new St.BoxLayout({style_class: 'di-peek', visible: false, y_align: Clutter.ActorAlign.CENTER});
        this._peekIcon = new St.Icon({style_class: 'di-peek-icon'});
        this._peekTextBox = new St.BoxLayout({style_class: 'di-peek-text', vertical: true, y_align: Clutter.ActorAlign.CENTER});
        this._peekTitle = new St.Label({style_class: 'di-peek-title'});
        this._peekBody = new St.Label({style_class: 'di-peek-body'});
        this._peekTitle.clutter_text.ellipsize = Pango.EllipsizeMode.END;
        this._peekBody.clutter_text.ellipsize = Pango.EllipsizeMode.END;
        this._peekTextBox.add_child(this._peekTitle);
        this._peekTextBox.add_child(this._peekBody);
        this._peekBox.add_child(this._peekIcon);
        this._peekBox.add_child(this._peekTextBox);
        this.add_child(this._peekBox);

        this._applyGeometry(COMPACT);

        this.connect('notify::hover', () => this._onHover());
        this.connect('notify::width', () => this._reposition());
        this.connect('notify::height', () => this._reposition());
        this.connect('destroy', () => this._onDestroy());
        Main.layoutManager.connectObject('monitors-changed', () => this._reposition(), this);
        settings.connectObject('changed', () => this._reposition(), this);
        this._eqId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 260, () => this._tickEq());
    }

    _onDestroy() {
        GLib.source_remove(this._eqId);
        if (this._progressId)
            GLib.source_remove(this._progressId);
        if (this._toastId)
            GLib.source_remove(this._toastId);
        if (this._peekId)
            GLib.source_remove(this._peekId);
        if (this._hoverId)
            GLib.source_remove(this._hoverId);
        this._timeline?.stop();
        this._artCancellable.cancel();
        Main.layoutManager.disconnectObject(this);
        this._settings.disconnectObject(this);
    }

    vfunc_button_release_event(event) {
        if (event.get_button() !== Clutter.BUTTON_PRIMARY)
            return Clutter.EVENT_PROPAGATE;

        if (this._peekActive && this._peekCallback) {
            try {
                this._peekCallback();
            } catch (e) {}
            this._dismissPeek();
            return Clutter.EVENT_STOP;
        }

        this._player?.raise();
        return Clutter.EVENT_STOP;
    }

    _button(iconName, callback) {
        const button = new St.Button({style_class: 'di-btn', child: new St.Icon({icon_name: iconName})});
        button.connect('clicked', callback);
        return button;
    }

    setPlayer(player) {
        this._player = player;
        this._hasMusic = !!player && !!player.trackTitle && player.status !== 'Stopped';
        if (this._hasMusic) {
            this._playButton.child.icon_name = player.status === 'Playing'
                ? 'media-playback-pause-symbolic' : 'media-playback-start-symbolic';
            const key = `${player.trackTitle}\n${player.trackArtists.join(', ')}\n${player.trackCoverUrl}`;
            if (key !== this._trackKey) {
                this._trackKey = key;
                this._swapTrack(player);
            }
        }
        this._refresh();
        this._tickEq();
    }

    // Temporary takeover of the island (volume, brightness, charger, Bluetooth)
    toast(icon, text, {level = null, color = null, duration = 2500} = {}) {
        this._toastIcon.gicon = toGicon(icon);
        this._toastIcon.style = color ? `color: ${color};` : null;
        this._toastLabel.text = text;
        this._toastLabel.visible = !!text;
        this._toastBar.visible = level !== null;
        if (level !== null) {
            this._toastFill.ease({
                width: Math.round(BAR_W * Math.max(0, Math.min(level, 1))),
                duration: 120,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            });
        }

        const wasActive = this._toastActive;
        this._toastActive = true;
        if (this._toastId)
            GLib.source_remove(this._toastId);
        this._toastId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, duration, () => {
            this._toastId = 0;
            this._toastActive = false;
            this._refresh();
            return GLib.SOURCE_REMOVE;
        });
        this._refresh();
        if (!wasActive) {
            this._toastBox.opacity = 0;
            this._toastBox.ease({opacity: 255, duration: 250, delay: 100, mode: Clutter.AnimationMode.EASE_OUT_QUAD});
        }
    }

    // Notification Peek mode (NotchNux Style)
    peekNotification(icon, title, body, callback = null, duration = 3800) {
        this._peekIcon.gicon = toGicon(icon);
        this._peekTitle.text = title || 'Thông báo';
        this._peekBody.text = body || '';
        this._peekBody.visible = !!body;
        this._peekCallback = callback;

        const wasActive = this._peekActive;
        this._peekActive = true;

        if (this._peekId)
            GLib.source_remove(this._peekId);
        this._peekId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, duration, () => {
            this._dismissPeek();
            return GLib.SOURCE_REMOVE;
        });

        this._refresh();
        if (!wasActive) {
            this._peekBox.opacity = 0;
            this._peekBox.ease({opacity: 255, duration: 250, delay: 100, mode: Clutter.AnimationMode.EASE_OUT_QUAD});
        }
    }

    _dismissPeek() {
        if (this._peekId)
            GLib.source_remove(this._peekId);
        this._peekId = 0;
        this._peekActive = false;
        this._peekCallback = null;
        this._refresh();
    }

    // Small persistent indicator (screen recording, download progress, system stats); null removes it
    setIndicator(key, opts) {
        let chip = this._indicators.get(key);
        if (!opts) {
            if (chip) {
                chip.destroy();
                this._indicators.delete(key);
                this._refresh();
            }
            return;
        }
        const added = !chip;
        if (added) {
            chip = new St.Button({style_class: 'di-chip', can_focus: false, reactive: !!opts.onClick});
            chip.set_child(new St.BoxLayout({style_class: 'di-chip-box'}));
            chip.child.add_child(new St.Icon({style_class: 'di-chip-icon'}));
            chip.child.add_child(new St.Label({style_class: 'di-chip-label', y_align: Clutter.ActorAlign.CENTER}));
            if (opts.onClick)
                chip.connect('clicked', opts.onClick);
            this._indicatorBox.add_child(chip);
            this._indicators.set(key, chip);
        }
        const [icon, label] = chip.child.get_children();
        icon.gicon = toGicon(opts.icon);
        icon.style = opts.color ? `color: ${opts.color};` : null;
        label.text = opts.text ?? '';
        label.visible = !!opts.text;
        if (added)
            this._refresh();
    }

    // Toggle expansion via hotkey
    toggleExpanded() {
        this._setExpanded(!this._expanded);
    }

    // Shows/hides each part for the current state, springing the island to its new size
    _refresh() {
        const hasIndicators = this._indicators.size > 0;
        const overlay = this._toastActive || this._peekActive;

        this._morph(() => {
            const music = this._hasMusic && !overlay;
            const expanded = music && this._expanded;
            this._art.visible = music;
            this._text.visible = music;
            this._artist.visible = expanded;
            this._controls.visible = expanded;
            this._scrubberBox.visible = expanded;
            this._eq.visible = music && !expanded;
            this._indicatorBox.visible = !overlay && hasIndicators;
            this._toastBox.visible = this._toastActive && !this._peekActive;
            this._peekBox.visible = this._peekActive;
        });

        this._setShown(this._hasMusic || hasIndicators || this._toastActive || this._peekActive);
        this._updateProgressTimer();
    }

    _updateProgressTimer() {
        const needProgress = this._hasMusic && this._expanded && !this._toastActive && !this._peekActive;
        if (needProgress && !this._progressId) {
            this._tickProgress();
            this._progressId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => this._tickProgress());
        } else if (!needProgress && this._progressId) {
            GLib.source_remove(this._progressId);
            this._progressId = 0;
        }
    }

    _tickProgress() {
        if (!this._player || !this._scrubberBox.visible)
            return GLib.SOURCE_CONTINUE;
        try {
            const proxy = this._player._playerProxy;
            if (!proxy)
                return GLib.SOURCE_CONTINUE;

            const posUs = proxy.Position ?? 0;
            let lenUs = 0;
            const meta = proxy.Metadata;
            if (meta && meta['mpris:length']) {
                lenUs = meta['mpris:length'].deepUnpack?.() ?? Number(meta['mpris:length']);
            }

            const posSec = Math.floor(posUs / 1000000);
            const lenSec = lenUs > 0 ? Math.floor(lenUs / 1000000) : 0;

            const fmt = s => {
                const m = Math.floor(s / 60);
                const r = Math.floor(s % 60);
                return `${m}:${r < 10 ? '0' : ''}${r}`;
            };

            this._timeCurrent.text = fmt(posSec);
            this._timeTotal.text = lenSec > 0 ? fmt(lenSec) : '--:--';

            const pct = lenSec > 0 ? Math.min(1, Math.max(0, posSec / lenSec)) : 0;
            this._scrubberFill.ease({
                width: Math.round(SCRUBBER_W * pct),
                duration: 200,
                mode: Clutter.AnimationMode.LINEAR,
            });
        } catch (e) {}
        return GLib.SOURCE_CONTINUE;
    }

    _setShown(shown) {
        if (shown === this._shown)
            return;
        this._shown = shown;
        if (shown) {
            this.show();
            this.set({opacity: 0, scale_x: 0.5, scale_y: 0.5});
            this.ease({opacity: 255, scale_x: 1, scale_y: 1, duration: 500, mode: Clutter.AnimationMode.EASE_OUT_BACK});
        } else {
            this.ease({
                opacity: 0,
                scale_x: 0.5,
                scale_y: 0.5,
                duration: 220,
                mode: Clutter.AnimationMode.EASE_IN_QUAD,
                onComplete: () => this.hide(),
            });
        }
    }

    _onHover() {
        // Small hover intent delay so passing the mouse over the island doesn't make it jump
        if (this._hoverId)
            GLib.source_remove(this._hoverId);
        this._hoverId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, this.hover ? 90 : 220, () => {
            this._hoverId = 0;
            this._setExpanded(this.hover);
            return GLib.SOURCE_REMOVE;
        });
    }

    _setExpanded(expanded) {
        if (expanded === this._expanded)
            return;
        this._expanded = expanded;
        this._refresh();
        if (!this._hasMusic || this._toastActive || this._peekActive)
            return;
        // Newly revealed content fades in once the island has started growing
        for (const actor of expanded ? [this._artist, this._controls, this._scrubberBox] : [this._eq]) {
            actor.opacity = 0;
            actor.ease({opacity: 255, duration: 250, delay: 120, mode: Clutter.AnimationMode.EASE_OUT_QUAD});
        }
    }

    // Applies a layout change, then springs size, corners, padding and cover to the new state.
    _morph(change) {
        const [fromWidth, fromHeight] = this.get_size();
        const from = this._geometry;
        const fromLayout = this._layout;
        this._timeline?.stop();
        this._timeline = null;

        this.set_size(-1, -1);
        change();
        this._layout = this._expanded && this._hasMusic && !this._toastActive && !this._peekActive ? EXPANDED : COMPACT;
        const to = this._layout;
        this._applyGeometry(to);
        if (!this._shown || !fromWidth)
            return;

        const [, toWidth] = this.get_preferred_width(-1);
        const [, toHeight] = this.get_preferred_height(toWidth);
        if (toWidth === fromWidth && toHeight === fromHeight && to === fromLayout)
            return;
        this._applyGeometry(from, fromWidth, fromHeight);

        const timeline = new Clutter.Timeline({actor: this, duration: 650});
        timeline.connect('new-frame', () => {
            const p = spring(timeline.get_elapsed_time() / 1000);
            this._applyGeometry({
                radius: lerp(from.radius, to.radius, p),
                padding: from.padding.map((v, i) => lerp(v, to.padding[i], p)),
                artSize: lerp(from.artSize, to.artSize, p),
                artRadius: lerp(from.artRadius, to.artRadius, p),
            }, lerp(fromWidth, toWidth, p), lerp(fromHeight, toHeight, p));
        });
        timeline.connect('stopped', (t, finished) => {
            if (!finished)
                return;
            this._applyGeometry(to);
            this.set_size(-1, -1);
            this._timeline = null;
        });
        this._timeline = timeline;
        timeline.start();
    }

    _applyGeometry(geometry, width, height) {
        this._geometry = geometry;
        const px = v => `${Math.max(0, Math.round(v))}px`;
        this.style = `border-radius: ${px(geometry.radius)}; padding: ${geometry.padding.map(px).join(' ')};`;
        const artSize = Math.round(geometry.artSize);
        this._art.set_size(artSize, artSize);
        this._art.style = `${this._artBackground} border-radius: ${px(geometry.artRadius)};`;
        if (width !== undefined)
            this.set_size(Math.round(width), Math.round(height));
    }

    _swapTrack(player) {
        const apply = () => this._morph(() => {
            this._title.text = player.trackTitle;
            this._artist.text = player.trackArtists.join(', ');
            this._setArt(player.trackCoverUrl);
        });
        if (!this._shown || !this._text.visible) {
            apply();
            return;
        }

        // Old track slides up and fades, new one slides in from below
        this._text.ease({
            opacity: 0,
            translation_y: -8,
            duration: 160,
            mode: Clutter.AnimationMode.EASE_IN_QUAD,
            onComplete: () => {
                apply();
                this._text.translation_y = 8;
                this._text.ease({opacity: 255, translation_y: 0, duration: 380, mode: Clutter.AnimationMode.EASE_OUT_QUAD});
            },
        });
        this._art.ease({
            scale_x: 0.6,
            scale_y: 0.6,
            opacity: 0,
            duration: 160,
            mode: Clutter.AnimationMode.EASE_IN_QUAD,
            onComplete: () => this._art.ease({
                scale_x: 1,
                scale_y: 1,
                opacity: 255,
                duration: 500,
                mode: Clutter.AnimationMode.EASE_OUT_BACK,
            }),
        });
    }

    _setArt(url) {
        if (!url || !url.startsWith('http')) {
            this._setArtBackground(url?.startsWith('file://') ? url : null);
            return;
        }
        // St can't load remote images, so https covers (Spotify) are downloaded to a cache first
        const dir = GLib.build_filenamev([GLib.get_user_cache_dir(), 'dynamic-island']);
        GLib.mkdir_with_parents(dir, 0o755);
        const dest = Gio.File.new_for_path(`${dir}/${GLib.compute_checksum_for_string(GLib.ChecksumType.MD5, url, -1)}`);
        if (dest.query_exists(null)) {
            this._setArtBackground(dest.get_uri());
            return;
        }
        Gio.File.new_for_uri(url).copy_async(dest, Gio.FileCopyFlags.OVERWRITE, GLib.PRIORITY_DEFAULT,
            this._artCancellable, null, (file, res) => {
                try {
                    file.copy_finish(res);
                } catch (e) {
                    if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                        console.warn(`dynamic-island: cover download failed: ${e.message}`);
                    return;
                }
                this._setArtBackground(dest.get_uri());
            });
    }

    _setArtBackground(uri) {
        this._artBackground = uri ? `background-image: url("${uri}");` : '';
        this._applyGeometry(this._geometry);
    }

    _tickEq() {
        if (!this.visible || !this._eq.visible)
            return GLib.SOURCE_CONTINUE;
        const playing = this._player?.status === 'Playing';
        for (const bar of this._eq.get_children()) {
            bar.ease({
                height: playing ? 4 + Math.round(Math.random() * 14) : 3,
                duration: 240,
                mode: Clutter.AnimationMode.EASE_IN_OUT_SINE,
            });
        }
        return GLib.SOURCE_CONTINUE;
    }

    _reposition() {
        const monitor = Main.layoutManager.primaryMonitor;
        if (!monitor)
            return;
        const [vertical, horizontal] = this._settings.get_string('position').split('-');
        const margin = this._settings.get_int('margin');
        let x = monitor.x + Math.floor((monitor.width - this.width) / 2);
        if (horizontal === 'left')
            x = monitor.x + margin;
        else if (horizontal === 'right')
            x = monitor.x + monitor.width - this.width - margin;
        const y = vertical === 'top'
            ? monitor.y + Main.panel.height + margin
            : monitor.y + monitor.height - this.height - margin;
        this.set_position(x, y);
    }
});
