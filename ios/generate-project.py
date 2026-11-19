"""Generate the small dependency-free Xcode project for stage-one development."""
from pathlib import Path
import hashlib

root = Path(__file__).resolve().parent
def uid(name): return hashlib.sha1(name.encode()).hexdigest()[:24].upper()
files = sorted((root / 'Lens').glob('*.swift')) + [root / 'Lens/Assets.xcassets']
objects = []
refs = []
sources = []
resources = []
for p in files:
    rel = p.relative_to(root).as_posix()
    f, b = uid(rel), uid('build:' + rel)
    kind = 'sourcecode.swift' if p.suffix == '.swift' else 'folder.assetcatalog'
    objects.append(f'{f} = {{isa = PBXFileReference; lastKnownFileType = {kind}; path = "{rel}"; sourceTree = "<group>"; }};')
    objects.append(f'{b} = {{isa = PBXBuildFile; fileRef = {f}; }};')
    refs.append(f)
    (sources if p.suffix == '.swift' else resources).append(b)
project, target, group, product, products, sp, rp, fp, pc, tc = map(uid, ['project','target','group','product','products','sources','resources','frameworks','projectConfigs','targetConfigs'])
objects += [
f'{project} = {{isa = PBXProject; attributes = {{LastUpgradeCheck = 2600; }}; buildConfigurationList = {pc}; compatibilityVersion = "Xcode 14.0"; developmentRegion = en; knownRegions = (en, Base); mainGroup = {group}; productRefGroup = {products}; projectDirPath = ""; targets = ({target}); }};',
f'{group} = {{isa = PBXGroup; children = ({",".join(refs)},{products}); sourceTree = "<group>"; }};',
f'{products} = {{isa = PBXGroup; children = ({product}); name = Products; sourceTree = "<group>"; }};',
f'{product} = {{isa = PBXFileReference; explicitFileType = wrapper.application; path = Lens.app; sourceTree = BUILT_PRODUCTS_DIR; }};',
f'{target} = {{isa = PBXNativeTarget; buildConfigurationList = {tc}; buildPhases = ({sp},{fp},{rp}); buildRules = (); dependencies = (); name = Lens; productName = Lens; productReference = {product}; productType = "com.apple.product-type.application"; }};',
f'{sp} = {{isa = PBXSourcesBuildPhase; buildActionMask = 2147483647; files = ({",".join(sources)}); runOnlyForDeploymentPostprocessing = 0; }};',
f'{rp} = {{isa = PBXResourcesBuildPhase; buildActionMask = 2147483647; files = ({",".join(resources)}); runOnlyForDeploymentPostprocessing = 0; }};',
f'{fp} = {{isa = PBXFrameworksBuildPhase; buildActionMask = 2147483647; files = (); runOnlyForDeploymentPostprocessing = 0; }};',
]
for scope, configlist in [('project',pc),('target',tc)]:
    configurations = []
    for mode in ['Debug','Release']:
        key = uid(scope+mode); configurations.append(key)
        settings = 'SDKROOT = iphoneos; IPHONEOS_DEPLOYMENT_TARGET = 17.0; SWIFT_VERSION = 5.0; CLANG_ENABLE_MODULES = YES;'
        if mode == 'Debug': settings += ' SWIFT_OPTIMIZATION_LEVEL = "-Onone"; DEBUG_INFORMATION_FORMAT = dwarf;'
        if scope == 'target':
            settings += ' ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon; PRODUCT_BUNDLE_IDENTIFIER = com.slpcc63.lens.browser; PRODUCT_NAME = Lens; GENERATE_INFOPLIST_FILE = YES; INFOPLIST_KEY_CFBundleDisplayName = Lens; INFOPLIST_KEY_UILaunchScreen_Generation = YES; INFOPLIST_KEY_ITSAppUsesNonExemptEncryption = NO; INFOPLIST_KEY_UISupportedInterfaceOrientations = "UIInterfaceOrientationPortrait UIInterfaceOrientationLandscapeLeft UIInterfaceOrientationLandscapeRight"; INFOPLIST_KEY_UISupportedInterfaceOrientations_iPad = "UIInterfaceOrientationPortrait UIInterfaceOrientationPortraitUpsideDown UIInterfaceOrientationLandscapeLeft UIInterfaceOrientationLandscapeRight"; INFOPLIST_KEY_UIApplicationSceneManifest_Generation = YES; INFOPLIST_KEY_NSFaceIDUsageDescription = "Unlock a saved website login."; INFOPLIST_KEY_NSLocationWhenInUseUsageDescription = "Allow a website you visit to use your location when you choose."; INFOPLIST_KEY_NSCameraUsageDescription = "Allow a website you visit to use your camera when you choose."; INFOPLIST_KEY_NSMicrophoneUsageDescription = "Allow a website you visit to use your microphone when you choose."; TARGETED_DEVICE_FAMILY = "1,2"; CODE_SIGN_STYLE = Automatic; CURRENT_PROJECT_VERSION = 1; MARKETING_VERSION = 0.1.0;'
        objects.append(f'{key} = {{isa = XCBuildConfiguration; buildSettings = {{{settings}}}; name = {mode}; }};')
    objects.append(f'{configlist} = {{isa = XCConfigurationList; buildConfigurations = ({",".join(configurations)}); defaultConfigurationIsVisible = 0; defaultConfigurationName = Release; }};')
directory = root / 'Lens.xcodeproj'
directory.mkdir(exist_ok=True)
(directory / 'project.pbxproj').write_text('// !$*UTF8*$!\n{ archiveVersion = 1; classes = {}; objectVersion = 56; objects = {\n'+'\n'.join(objects)+f'\n}}; rootObject = {project}; }}\n')
scheme = directory / 'xcshareddata/xcschemes'
scheme.mkdir(parents=True,exist_ok=True)
(scheme / 'Lens.xcscheme').write_text(f'''<?xml version="1.0" encoding="UTF-8"?>
<Scheme LastUpgradeVersion="2600" version="1.3"><BuildAction parallelizeBuildables="YES" buildImplicitDependencies="YES"><BuildActionEntries><BuildActionEntry buildForTesting="YES" buildForRunning="YES" buildForProfiling="YES" buildForArchiving="YES" buildForAnalyzing="YES"><BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="{target}" BuildableName="Lens.app" BlueprintName="Lens" ReferencedContainer="container:Lens.xcodeproj"/></BuildActionEntry></BuildActionEntries></BuildAction><LaunchAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" launchStyle="0" useCustomWorkingDirectory="NO" ignoresPersistentStateOnLaunch="NO" debugDocumentVersioning="YES" allowLocationSimulation="YES"><BuildableProductRunnable runnableDebuggingMode="0"><BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="{target}" BuildableName="Lens.app" BlueprintName="Lens" ReferencedContainer="container:Lens.xcodeproj"/></BuildableProductRunnable></LaunchAction><ArchiveAction buildConfiguration="Release" revealArchiveInOrganizer="YES"/></Scheme>''')
