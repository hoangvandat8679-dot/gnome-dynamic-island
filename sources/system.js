import GLib from 'gi://GLib';

export class SystemSource {
    constructor(island, settings) {
        this._island = island;
        this._settings = settings;
        this._lastCpu = null;
        this._timerId = 0;

        this._settingsId = this._settings.connect('changed::show-system', () => {
            this._update();
        });

        // Run initial update and poll every 3 seconds
        this._update();
        this._timerId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 3, () => {
            this._update();
            return GLib.SOURCE_CONTINUE;
        });
    }

    _readCpu() {
        try {
            const [ok, bytes] = GLib.file_get_contents('/proc/stat');
            if (!ok) return null;
            const str = new TextDecoder().decode(bytes);
            const line = str.split('\n')[0];
            const parts = line.trim().split(/\s+/).slice(1).map(Number);
            const idle = parts[3] + (parts[4] || 0); // idle + iowait
            const total = parts.reduce((a, b) => a + b, 0);
            return {idle, total};
        } catch (e) {
            return null;
        }
    }

    _readRam() {
        try {
            const [ok, bytes] = GLib.file_get_contents('/proc/meminfo');
            if (!ok) return null;
            const str = new TextDecoder().decode(bytes);
            const totalMatch = str.match(/MemTotal:\s+(\d+)/);
            const availMatch = str.match(/MemAvailable:\s+(\d+)/);
            if (!totalMatch || !availMatch) return null;
            const totalKb = parseInt(totalMatch[1], 10);
            const availKb = parseInt(availMatch[1], 10);
            const usedKb = totalKb - availKb;
            const usedGb = (usedKb / (1024 * 1024)).toFixed(1);
            return {usedGb};
        } catch (e) {
            return null;
        }
    }

    _update() {
        if (!this._island) return;

        if (this._settings.list_keys().includes('show-system') &&
            !this._settings.get_boolean('show-system')) {
            this._island.setIndicator('system', null);
            return;
        }

        const currentCpu = this._readCpu();
        const ram = this._readRam();
        let cpuPct = 0;

        if (this._lastCpu && currentCpu) {
            const deltaTotal = currentCpu.total - this._lastCpu.total;
            const deltaIdle = currentCpu.idle - this._lastCpu.idle;
            if (deltaTotal > 0) {
                cpuPct = Math.round(100 * (1 - deltaIdle / deltaTotal));
                cpuPct = Math.max(0, Math.min(100, cpuPct));
            }
        }
        this._lastCpu = currentCpu;

        if (ram) {
            this._island.setIndicator('system', {
                icon: 'utilities-system-monitor-symbolic',
                text: `${cpuPct}% • ${ram.usedGb}G`,
                color: cpuPct > 80 ? '#ff453a' : null,
                onClick: () => {
                    try {
                        GLib.spawn_command_line_async('gnome-system-monitor');
                    } catch (e) {}
                },
            });
        }
    }

    destroy() {
        if (this._timerId) {
            GLib.source_remove(this._timerId);
            this._timerId = 0;
        }
        if (this._settingsId && this._settings) {
            this._settings.disconnect(this._settingsId);
            this._settingsId = 0;
        }
        this._island?.setIndicator('system', null);
        this._island = null;
        this._settings = null;
    }
}
