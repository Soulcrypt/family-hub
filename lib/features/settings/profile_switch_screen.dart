import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/services/profile_service.dart';

class ProfileSwitchScreen extends StatefulWidget {
  const ProfileSwitchScreen({super.key});

  @override
  State<ProfileSwitchScreen> createState() => _ProfileSwitchScreenState();
}

class _ProfileSwitchScreenState extends State<ProfileSwitchScreen> {
  late String _selectedId;

  @override
  void initState() {
    super.initState();
    _selectedId = profileService.currentProfile.id;
  }

  @override
  Widget build(BuildContext context) {
    final profiles = profileService.allProfiles;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Switch Profile'),
      ),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Select Profile:'),
            const SizedBox(height: 16),
            DropdownButton<String>(
              value: _selectedId,
              items: [
                for (final p in profiles)
                  DropdownMenuItem(
                    value: p.id,
                    child: Text(p.name),
                  )
              ],
              onChanged: (id) {
                if (id == null) return;
                setState(() => _selectedId = id);
                profileService.switchProfile(id);
                context.go('/dashboard');
              },
            ),
          ],
        ),
      ),
    );
  }
}
