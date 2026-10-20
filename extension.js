import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import {Island} from './island.js';
import {BatterySource} from './sources/battery.js';
import {BluetoothSource} from './sources/bluetooth.js';
import {MediaSource} from './sources/media.js';
import {NotificationSource} from './sources/notification.js';
import {OsdSource} from './sources/osd.js';
import {PomodoroSource} from './sources/pomodoro.js';
import {ProgressSource} from './sources/progress.js';
import {RecordingSource} from './sources/recording.js';
import {SystemSource} from './sources/system.js';

const SOURCES = [
    MediaSource,
    OsdSource,
    BatterySource,
    RecordingSource,
    BluetoothSource,
    ProgressSource,
    NotificationSource,
    SystemSource,
    PomodoroSource,
];

export default class DynamicIslandExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._island = new Island(this._settings);
        Main.layoutManager.addTopChrome(this._island);
        this._sources = SOURCES.map(Source => new Source(this._island, this._settings));

        // Register Global Keybinding (Super + I by default)
        try {
            Main.wm.addKeybinding(
                'hotkey-toggle',
                this._settings,
                Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
                Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
                () => this._island?.toggleExpanded()
            );
        } catch (e) {
            console.warn(`dynamic-island: failed to add keybinding: ${e.message}`);
        }
    }

    disable() {
        try {
            Main.wm.removeKeybinding('hotkey-toggle');
        } catch (e) {}

        if (this._sources) {
            this._sources.forEach(source => source.destroy());
            this._sources = null;
        }

        if (this._island) {
            this._island.destroy();
            this._island = null;
        }

        this._settings = null;
    }
}
