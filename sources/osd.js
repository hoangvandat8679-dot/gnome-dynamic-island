import * as Main from 'resource:///org/gnome/shell/ui/main.js';

// Shows volume and brightness changes on the island instead of the shell's OSD pop-up
export class OsdSource {
    constructor(island, settings) {
        const osd = Main.osdWindowManager;
        this._island = island;
        this._settings = settings;

        this._originalShow = osd.show?.bind(osd);
        this._originalShowAll = osd.showAll?.bind(osd);
        this._originalShowOne = osd.showOne?.bind(osd);

        const handleToast = (icon, label, level) => {
            if (!settings.get_boolean('show-volume'))
                return false;
            const hasLevel = typeof level === 'number' && !isNaN(level);
            island.toast(icon, hasLevel ? '' : (label ?? ''), {
                level: hasLevel ? level : null,
                duration: 1500,
            });
            return true;
        };

        // GNOME 47+ volume uses showAll(icon, label, level, maxLevel)
        if (osd.showAll) {
            osd.showAll = (icon, label, level, maxLevel) => {
                if (!handleToast(icon, label, level)) {
                    this._originalShowAll(icon, label, level, maxLevel);
                }
            };
        }

        // GNOME 47+ showOne(monitorIndex, icon, label, level, maxLevel)
        if (osd.showOne) {
            osd.showOne = (monitorIndex, icon, label, level, maxLevel) => {
                if (!handleToast(icon, label, level)) {
                    this._originalShowOne(monitorIndex, icon, label, level, maxLevel);
                }
            };
        }

        // GNOME 47+ show(icon, label, levels)
        // GNOME 46- show(monitorIndex, icon, label, level, maxLevel)
        if (osd.show) {
            osd.show = (...args) => {
                if (!settings.get_boolean('show-volume')) {
                    this._originalShow(...args);
                    return;
                }

                if (typeof args[0] === 'number') {
                    // GNOME 46 style: (monitorIndex, icon, label, level, maxLevel)
                    const [, icon, label, level] = args;
                    handleToast(icon, label, level);
                } else {
                    // GNOME 47+ style: (icon, label, levels)
                    const [icon, label, levels] = args;
                    let level = null;
                    if (levels) {
                        if (Array.isArray(levels)) {
                            const entry = levels.find(l => l && typeof l.level === 'number');
                            if (entry)
                                level = entry.level;
                        } else if (typeof levels === 'object') {
                            const entries = Object.values(levels);
                            const entry = entries.find(l => l && typeof l.level === 'number');
                            if (entry)
                                level = entry.level;
                        }
                    }
                    handleToast(icon, label, level);
                }
            };
        }
    }

    destroy() {
        if (this._originalShow)
            Main.osdWindowManager.show = this._originalShow;
        if (this._originalShowAll)
            Main.osdWindowManager.showAll = this._originalShowAll;
        if (this._originalShowOne)
            Main.osdWindowManager.showOne = this._originalShowOne;
        this._originalShow = null;
        this._originalShowAll = null;
        this._originalShowOne = null;
        this._island = null;
        this._settings = null;
    }
}
