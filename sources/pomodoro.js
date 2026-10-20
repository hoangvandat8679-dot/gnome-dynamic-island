import GLib from 'gi://GLib';

export class PomodoroSource {
    constructor(island, settings) {
        this._island = island;
        this._settings = settings;
        this._mode = 'idle'; // 'work' | 'break' | 'idle'
        this._secondsLeft = 25 * 60;
        this._timerId = 0;

        this._settingsId = this._settings.connect('changed::show-pomodoro', () => {
            this._updateIndicator();
        });

        this._updateIndicator();
    }

    _updateIndicator() {
        if (!this._island) return;

        if (this._settings.list_keys().includes('show-pomodoro') &&
            !this._settings.get_boolean('show-pomodoro')) {
            this._island.setIndicator('pomodoro', null);
            return;
        }

        if (this._mode === 'idle') {
            this._island.setIndicator('pomodoro', {
                icon: 'alarm-symbolic',
                text: '25m',
                color: '#ff9f0a',
                onClick: () => this.toggle(),
            });
            return;
        }

        const m = Math.floor(this._secondsLeft / 60);
        const s = this._secondsLeft % 60;
        const timeStr = `${m}:${s < 10 ? '0' : ''}${s}`;
        const isWork = this._mode === 'work';

        this._island.setIndicator('pomodoro', {
            icon: isWork ? 'alarm-symbolic' : 'preferences-system-time-symbolic',
            text: timeStr,
            color: isWork ? '#ff453a' : '#30d158',
            onClick: () => this.toggle(),
        });
    }

    toggle() {
        if (this._mode === 'idle') {
            this._mode = 'work';
            this._secondsLeft = 25 * 60;
            this._startTimer();
            this._island?.toast('alarm-symbolic', 'Pomodoro: 25 phút tập trung!', {duration: 2500, color: '#ff453a'});
        } else if (this._mode === 'work') {
            this._mode = 'break';
            this._secondsLeft = 5 * 60;
            this._island?.toast('preferences-system-time-symbolic', 'Pomodoro: Nghỉ 5 phút!', {duration: 2500, color: '#30d158'});
        } else {
            this._mode = 'idle';
            this._stopTimer();
            this._secondsLeft = 25 * 60;
            this._island?.toast('process-stop-symbolic', 'Đã dừng Pomodoro', {duration: 2000});
        }
        this._updateIndicator();
    }

    _startTimer() {
        this._stopTimer();
        this._timerId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => {
            if (this._secondsLeft > 0) {
                this._secondsLeft--;
                this._updateIndicator();
                return GLib.SOURCE_CONTINUE;
            } else {
                if (this._mode === 'work') {
                    this._mode = 'break';
                    this._secondsLeft = 5 * 60;
                    this._island?.toast('alarm-symbolic', 'Hết giờ làm việc! Nghỉ 5 phút nhé ☕', {duration: 5000, color: '#30d158'});
                } else {
                    this._mode = 'idle';
                    this._stopTimer();
                    this._secondsLeft = 25 * 60;
                    this._island?.toast('alarm-symbolic', 'Hoàn thành phiên làm việc! 🎉', {duration: 5000, color: '#ff9f0a'});
                }
                this._updateIndicator();
                return GLib.SOURCE_REMOVE;
            }
        });
    }

    _stopTimer() {
        if (this._timerId) {
            GLib.source_remove(this._timerId);
            this._timerId = 0;
        }
    }

    destroy() {
        this._stopTimer();
        if (this._settingsId && this._settings) {
            this._settings.disconnect(this._settingsId);
            this._settingsId = 0;
        }
        this._island?.setIndicator('pomodoro', null);
        this._island = null;
        this._settings = null;
    }
}
