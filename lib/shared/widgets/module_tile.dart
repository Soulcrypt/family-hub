import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// Tile widget used on the dashboard to open a module screen.
///
/// The tile is displayed as a square with rounded corners and a soft shadow,
/// mimicking the style of iOS home screen icons. When tapped, it will either
/// execute the provided [onTap] callback or, if none is supplied, navigate to a
/// route inferred from the [title].
class ModuleTile extends StatelessWidget {
  final String title;
  final IconData icon;
  final VoidCallback? onTap;

  const ModuleTile({
    super.key,
    required this.title,
    required this.icon,
    this.onTap,
  });

  String? _routeForTitle() {
    switch (title.toLowerCase()) {
      case 'calendar':
        return '/calendar';
      case 'budgeting':
      case 'budget':
        return '/budget';
      case 'chores':
        return '/chores';
      case 'settings':
        return '/settings';
      case 'profiles':
        return '/profiles';
      default:
        return null;
    }
  }

  @override
  Widget build(BuildContext context) {
    final route = _routeForTitle();

    VoidCallback? callback = onTap;
    if (callback == null && route != null) {
      callback = () => context.go(route);
    }

    return SizedBox(
      width: 100,
      height: 100,
      child: Material(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(20),
        elevation: 4,
        shadowColor: Colors.black26,
        child: InkWell(
          borderRadius: BorderRadius.circular(20),
          onTap: callback,
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(icon, size: 32),
                const SizedBox(height: 8),
                Text(
                  title,
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
