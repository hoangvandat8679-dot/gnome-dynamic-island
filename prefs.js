import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const POSITIONS = [
    ['top-center', 'Top center (Giữa trên)'],
    ['top-left', 'Top left (Góc trên trái)'],
    ['top-right', 'Top right (Góc trên phải)'],
    ['bottom-center', 'Bottom center (Giữa dưới)'],
    ['bottom-left', 'Bottom left (Góc dưới trái)'],
    ['bottom-right', 'Bottom right (Góc dưới phải)'],
];

const FEATURES = [
    ['show-volume', 'Âm lượng & Độ sáng (Volume & Brightness OSD)'],
    ['show-battery', 'Cắm/rút sạc pin (Battery Charger)'],
    ['show-recording', 'Đếm giờ quay màn hình (Screen Recording)'],
    ['show-bluetooth', 'Kết nối Bluetooth (Bluetooth Devices)'],
    ['show-progress', 'Tiến trình tải & sao chép file (Download/Copy)'],
    ['show-notifications', 'Xem nhanh thông báo (Notification Peek)'],
    ['show-system', 'Giám sát CPU & RAM (Hardware Monitor)'],
    ['show-pomodoro', 'Bộ đếm tập trung (Pomodoro Timer)'],
];

export default class DynamicIslandPrefs extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const page = new Adw.PreferencesPage();

        // Group 1: Vị trí & Khoảng cách
        const groupPosition = new Adw.PreferencesGroup({title: 'Vị trí hiển thị (Position)'});

        const position = new Adw.ComboRow({
            title: 'Vị trí đảo',
            model: Gtk.StringList.new(POSITIONS.map(p => p[1])),
            selected: Math.max(0, POSITIONS.findIndex(p => p[0] === settings.get_string('position'))),
        });
        position.connect('notify::selected', () => settings.set_string('position', POSITIONS[position.selected][0]));

        const margin = new Adw.SpinRow({
            title: 'Khoảng cách mép màn hình',
            subtitle: 'Đơn vị tính: Pixel (px)',
            adjustment: new Gtk.Adjustment({lower: 0, upper: 300, step_increment: 1, page_increment: 10}),
        });
        settings.bind('margin', margin, 'value', Gio.SettingsBindFlags.DEFAULT);

        groupPosition.add(position);
        groupPosition.add(margin);
        page.add(groupPosition);

        // Group 2: Các tính năng hiển thị
        const groupFeatures = new Adw.PreferencesGroup({title: 'Tính năng trên Đảo nổi (Features)'});
        for (const [key, title] of FEATURES) {
            const row = new Adw.SwitchRow({title});
            settings.bind(key, row, 'active', Gio.SettingsBindFlags.DEFAULT);
            groupFeatures.add(row);
        }
        page.add(groupFeatures);

        // Group 3: Phím tắt & Trợ giúp
        const groupShortcuts = new Adw.PreferencesGroup({title: 'Phím tắt toàn cục (Shortcuts)'});
        const hotkeyRow = new Adw.ActionRow({
            title: 'Bật / Thu gọn đảo tức thì',
            subtitle: 'Mặc định: Phím Super (Windows) + I',
        });
        groupShortcuts.add(hotkeyRow);
        page.add(groupShortcuts);

        window.add(page);
    }
}
