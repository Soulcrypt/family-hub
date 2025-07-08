import 'package:flutter/material.dart';
import '../../shared/widgets/module_tile.dart';
import 'package:go_router/go_router.dart';

class DashboardScreen extends StatelessWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Family Hub'),
      ),
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              'Dashboard Placeholder',
              style: TextStyle(fontSize: 24),
            ),
            const SizedBox(height: 16),
            Wrap(
              spacing: 12,
              runSpacing: 12,
              children: const [
                ModuleTile(
                  title: 'Calendar',
                  icon: Icons.event,
                ),
                ModuleTile(
                  title: 'Budgeting',
                  icon: Icons.attach_money,
                ),
                ModuleTile(
                  title: 'Chores',
                  icon: Icons.check_box,
                ),
                ModuleTile(
                  title: 'Settings',
                  icon: Icons.settings,
                ),
                ModuleTile(
                  title: 'Profiles',
                  icon: Icons.person,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
