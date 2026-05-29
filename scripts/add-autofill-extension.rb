#!/usr/bin/env ruby
# Adds the AutoFillProvider extension target to the Capacitor iOS project.
# Idempotent: safe to re-run.

require 'xcodeproj'
require 'fileutils'

PROJECT_PATH = File.expand_path('../ios/App/App.xcodeproj', __dir__)
EXTENSION_NAME = 'AutoFillProvider'
EXTENSION_BUNDLE_ID = 'app.ironvault.ios.AutoFillProvider'
HOST_APP_TARGET = 'App'
TEAM_ID = 'TQ6YZ5BJ6R'
EXTENSION_SOURCE_DIR = File.expand_path("../ios/App/#{EXTENSION_NAME}", __dir__)

abort "Project not found at #{PROJECT_PATH}" unless File.exist?(PROJECT_PATH)
abort "Extension source dir missing: #{EXTENSION_SOURCE_DIR}" unless Dir.exist?(EXTENSION_SOURCE_DIR)

project = Xcodeproj::Project.open(PROJECT_PATH)

host_target = project.targets.find { |t| t.name == HOST_APP_TARGET }
abort "Host target '#{HOST_APP_TARGET}' not found." unless host_target

existing = project.targets.find { |t| t.name == EXTENSION_NAME }
if existing
  puts "Target '#{EXTENSION_NAME}' already exists — refreshing build settings."
  ext_target = existing
else
  puts "Creating new app extension target: #{EXTENSION_NAME}"
  ext_target = project.new_target(:app_extension, EXTENSION_NAME, :ios, '15.0')
end

# Build settings
ext_target.build_configurations.each do |config|
  bs = config.build_settings
  bs['PRODUCT_BUNDLE_IDENTIFIER'] = EXTENSION_BUNDLE_ID
  bs['PRODUCT_NAME'] = '$(TARGET_NAME)'
  bs['INFOPLIST_FILE'] = "#{EXTENSION_NAME}/Info.plist"
  bs['CODE_SIGN_ENTITLEMENTS'] = "#{EXTENSION_NAME}/#{EXTENSION_NAME}.entitlements"
  bs['CODE_SIGN_STYLE'] = 'Automatic'
  bs['DEVELOPMENT_TEAM'] = TEAM_ID
  bs['SWIFT_VERSION'] = '5.0'
  bs['IPHONEOS_DEPLOYMENT_TARGET'] = '15.0'
  bs['TARGETED_DEVICE_FAMILY'] = '1,2'
  bs['LD_RUNPATH_SEARCH_PATHS'] = '$(inherited) @executable_path/Frameworks @executable_path/../../Frameworks'
  bs['MARKETING_VERSION'] = '1.0'
  bs['CURRENT_PROJECT_VERSION'] = '1'
  bs['ENABLE_BITCODE'] = 'NO'
  bs['SKIP_INSTALL'] = 'YES'
  bs['CLANG_ENABLE_MODULES'] = 'YES'
  bs['ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES'] = 'YES'
end

# Create / reuse a PBXGroup for the extension's files in the project's main group.
main_group = project.main_group
ext_group = main_group.groups.find { |g| g.display_name == EXTENSION_NAME }
if ext_group.nil?
  ext_group = main_group.new_group(EXTENSION_NAME, EXTENSION_NAME)
end

# Helper: add a file ref to the group, avoiding duplicates.
def ensure_file_ref(group, project_relative_path, absolute_path)
  existing_ref = group.files.find { |f| f.path == File.basename(absolute_path) || f.real_path.to_s == absolute_path }
  return existing_ref if existing_ref
  ref = group.new_reference(File.basename(absolute_path))
  ref.path = File.basename(absolute_path)
  ref.source_tree = '<group>'
  ref
end

# Source file
swift_ref = ensure_file_ref(ext_group, "#{EXTENSION_NAME}/CredentialProviderViewController.swift",
                            File.join(EXTENSION_SOURCE_DIR, 'CredentialProviderViewController.swift'))

# Add to sources phase if not present
sources_phase = ext_target.source_build_phase
unless sources_phase.files_references.include?(swift_ref)
  sources_phase.add_file_reference(swift_ref)
end

# Storyboard
storyboard_group = ext_group.groups.find { |g| g.display_name == 'Base.lproj' } || ext_group.new_group('Base.lproj', 'Base.lproj')
storyboard_existing = storyboard_group.files.find { |f| f.path == 'MainInterface.storyboard' }
storyboard_ref = storyboard_existing || begin
  ref = storyboard_group.new_reference('MainInterface.storyboard')
  ref.path = 'MainInterface.storyboard'
  ref.source_tree = '<group>'
  ref
end

resources_phase = ext_target.resources_build_phase
unless resources_phase.files_references.include?(storyboard_ref)
  resources_phase.add_file_reference(storyboard_ref)
end

# Info.plist / entitlements need to exist in the group but should NOT be in any build phase.
['Info.plist', "#{EXTENSION_NAME}.entitlements"].each do |fname|
  next if ext_group.files.find { |f| f.path == fname }
  ref = ext_group.new_reference(fname)
  ref.path = fname
  ref.source_tree = '<group>'
end

# Link AuthenticationServices framework
frameworks_phase = ext_target.frameworks_build_phase
unless frameworks_phase.files_references.any? { |f| f.path&.include?('AuthenticationServices') }
  frameworks_group = project.frameworks_group
  fw_ref = frameworks_group.files.find { |f| f.path == 'AuthenticationServices.framework' }
  fw_ref ||= frameworks_group.new_reference('System/Library/Frameworks/AuthenticationServices.framework').tap do |r|
    r.source_tree = 'SDKROOT'
  end
  frameworks_phase.add_file_reference(fw_ref)
end

# Embed the extension in the host app via the "Embed App Extensions" copy phase.
embed_phase = host_target.copy_files_build_phases.find do |phase|
  phase.symbol_dst_subfolder_spec == :plug_ins || phase.dst_subfolder_spec == '13'
end

unless embed_phase
  embed_phase = host_target.new_copy_files_build_phase('Embed App Extensions')
  embed_phase.symbol_dst_subfolder_spec = :plug_ins
end

product_ref = ext_target.product_reference
already_embedded = embed_phase.files.any? { |bf| bf.file_ref == product_ref }
unless already_embedded
  build_file = embed_phase.add_file_reference(product_ref)
  build_file.settings = { 'ATTRIBUTES' => ['RemoveHeadersOnCopy'] }
end

# Add host -> extension target dependency
unless host_target.dependencies.any? { |d| d.target == ext_target }
  host_target.add_dependency(ext_target)
end

# Save the project
project.save

puts "✅ Project updated: #{PROJECT_PATH}"
puts "   Extension target: #{EXTENSION_NAME} (#{EXTENSION_BUNDLE_ID})"
puts "   Embedded in host: #{HOST_APP_TARGET}"
