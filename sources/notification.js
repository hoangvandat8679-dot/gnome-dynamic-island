import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export class NotificationSource {
    constructor(island, settings) {
        this._island = island;
        this._settings = settings;
        this._sources = new Map();

        if (Main.messageTray) {
            try {
                for (const source of Main.messageTray.getSources()) {
                    this._connectSource(source);
                }
            } catch (e) {
                console.warn(`dynamic-island: failed to get sources: ${e.message}`);
            }

            this._sourceAddedId = Main.messageTray.connect('source-added', (_tray, source) => {
                this._connectSource(source);
            });
        }
    }

    _connectSource(source) {
        if (!source || this._sources.has(source))
            return;

        const reqId = source.connect('notification-request-banner', (_src, notification) => {
            this._onNotification(source, notification);
        });
        const notifAddedId = source.connect('notification-added', (_src, notification) => {
            this._onNotification(source, notification);
        });
        const destroyId = source.connect('destroy', () => {
            this._sources.delete(source);
        });

        this._sources.set(source, [reqId, notifAddedId, destroyId]);
    }

    _onNotification(source, notification) {
        if (!notification || !this._island)
            return;

        try {
            if (this._settings.list_keys().includes('show-notifications') &&
                !this._settings.get_boolean('show-notifications'))
                return;
        } catch (e) {}

        const title = notification.title || source.title || 'Thông báo';
        const body = notification.bannerBodyText || notification.body || '';
        const icon = notification.gicon || source.icon || 'dialog-information-symbolic';

        this._island.peekNotification(icon, title, body, () => {
            try {
                notification.activate();
            } catch (e) {
                try { source.open?.(); } catch (err) {}
            }
        });
    }

    destroy() {
        if (this._sourceAddedId && Main.messageTray) {
            Main.messageTray.disconnect(this._sourceAddedId);
            this._sourceAddedId = 0;
        }
        for (const [source, ids] of this._sources.entries()) {
            ids.forEach(id => {
                try { source.disconnect(id); } catch (e) {}
            });
        }
        this._sources.clear();
        this._island = null;
        this._settings = null;
    }
}
