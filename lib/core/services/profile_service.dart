import 'package:flutter/foundation.dart';

import '../models/profile.dart';

class ProfileService extends ChangeNotifier {
  ProfileService()
      : _currentProfileNotifier =
            ValueNotifier<UserProfile>(_mockProfiles.first);

  // Mock profiles available in the app.
  static const List<UserProfile> _mockProfiles = [
    UserProfile(
      id: 'parent1',
      name: 'Alice',
      role: UserRole.parent,
      allowedModules: ['calendar', 'chores', 'shopping'],
    ),
    UserProfile(
      id: 'kid1',
      name: 'Bobby',
      role: UserRole.kid,
      allowedModules: ['calendar', 'games'],
    ),
    UserProfile(
      id: 'admin1',
      name: 'Admin',
      role: UserRole.admin,
      allowedModules: ['calendar', 'chores', 'shopping', 'settings'],
    ),
  ];

  /// Notifies listeners whenever the current profile changes.
  final ValueNotifier<UserProfile> _currentProfileNotifier;

  /// All mock profiles.
  List<UserProfile> get allProfiles => List.unmodifiable(_mockProfiles);

  /// Current active profile notifier.
  ValueNotifier<UserProfile> get currentProfileNotifier => _currentProfileNotifier;

  /// Convenience getter for the current profile.
  UserProfile get currentProfile => _currentProfileNotifier.value;

  /// Switch to a different profile by its [id].
  void switchProfile(String id) {
    final profile =
        _mockProfiles.firstWhere((p) => p.id == id, orElse: () => currentProfile);
    if (profile.id != _currentProfileNotifier.value.id) {
      _currentProfileNotifier.value = profile;
      notifyListeners();
    }
  }
}

/// Global instance of [ProfileService] used throughout the app.
final ProfileService profileService = ProfileService();
