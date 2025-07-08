import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// Tile widget for launching a module screen.
class ModuleTile extends StatelessWidget {
  final String moduleName;
  final IconData icon;

  const ModuleTile({
    super.key,
    required this.moduleName,
    required this.icon,
  });

  String? _routeForModule() {
    switch (moduleName.toLowerCase()) {
      case 'calendar':
        return '/calendar';
      case 'budgeting':
      case 'budget':
        return '/budget';
      case 'chores':
        return '/chores';
      case 'settings':
        return '/settings';
      default:
        return null;
    }
  }

  @override
  Widget build(BuildContext context) {
    final route = _routeForModule();

    return ListTile(
      leading: Icon(icon),
      title: Text(moduleName),
      onTap: route == null ? null : () => context.go(route),
    );
  }
}
