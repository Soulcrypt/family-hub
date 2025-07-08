import 'package:flutter/material.dart';
import '../../modules/calendar/calendar_screen.dart';

/// Tile widget for launching a module screen.
class ModuleTile extends StatelessWidget {
  final String moduleName;
  final IconData icon;

  const ModuleTile({
    super.key,
    required this.moduleName,
    required this.icon,
  });

  Widget? _screenForModule() {
    switch (moduleName.toLowerCase()) {
      case 'calendar':
        return const CalendarScreen();
      default:
        return null;
    }
  }

  @override
  Widget build(BuildContext context) {
    final screen = _screenForModule();

    return ListTile(
      leading: Icon(icon),
      title: Text(moduleName),
      onTap: screen == null
          ? null
          : () {
              Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => screen),
              );
            },
    );
  }
}
