import 'package:flutter/material.dart';
import '../profiles/profiles_screen.dart';
import '../../shared/widgets/module_tile.dart';

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
            ModuleTile(
              moduleName: 'Calendar',
              icon: Icons.event,
            ),
            const SizedBox(height: 8),
            ElevatedButton(
              onPressed: () {
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (context) => const ProfilesScreen(),
                  ),
                );
              },
              child: const Text('View Profiles'),
            ),
          ],
        ),
      ),
    );
  }
}
