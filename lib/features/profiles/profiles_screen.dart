import 'package:flutter/material.dart';
import '../../core/services/profile_service.dart';

class ProfilesScreen extends StatelessWidget {
  const ProfilesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final service = ProfileService();
    final profiles = service.getAllProfiles();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Profiles'),
      ),
      body: ListView.builder(
        itemCount: profiles.length,
        itemBuilder: (context, index) {
          final profile = profiles[index];
          return ListTile(
            leading: const Icon(Icons.person),
            title: Text(profile.id),
            subtitle: Text(profile.role.name),
            trailing: Text(profile.visibleModules.join(', ')),
          );
        },
      ),
    );
  }
}
