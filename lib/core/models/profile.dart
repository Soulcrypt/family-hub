enum UserRole { parent, kid, admin }

class UserProfile {
  final String id;
  final String name;
  final UserRole role;
  final List<String> allowedModules;

  const UserProfile({
    required this.id,
    required this.name,
    required this.role,
    required this.allowedModules,
  });
}
