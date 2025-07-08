import 'package:flutter/material.dart';
import '../../shared/widgets/module_tile.dart';
import '../../core/services/profile_service.dart';
import '../../core/models/profile.dart';

class DashboardScreen extends StatelessWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Family Hub'),
      ),
      body: ValueListenableBuilder<UserProfile>(
        valueListenable: profileService.currentProfileNotifier,
        builder: (context, profile, _) {
          final tiles = <Widget>[];
          for (final module in profile.allowedModules) {
            switch (module) {
              case 'calendar':
                tiles.add(const ModuleTile(title: 'Calendar', icon: Icons.event));
                break;
              case 'chores':
                tiles.add(const ModuleTile(title: 'Chores', icon: Icons.check_box));
                break;
              case 'settings':
                tiles.add(const ModuleTile(title: 'Settings', icon: Icons.settings));
                break;
              case 'budget':
              case 'budgeting':
                tiles.add(const ModuleTile(title: 'Budgeting', icon: Icons.attach_money));
                break;
              case 'profiles':
                tiles.add(const ModuleTile(title: 'Profiles', icon: Icons.person));
                break;
              default:
                break;
            }
          }

          return GridView.count(
            padding: const EdgeInsets.all(16),
            crossAxisCount: 2,
            mainAxisSpacing: 16,
            crossAxisSpacing: 16,
            children: tiles,
          );
        },
      ),
    );
  }
}
