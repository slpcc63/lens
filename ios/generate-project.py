"""Generate the small dependency-free Xcode project for stage-one development."""
from pathlib import Path
import hashlib

root = Path(__file__).resolve().parent
def uid(name): return hashlib.sha1(name.encode()).hexdigest()[:24].upper()
files = sorted((root / 'Lens').glob('*.swift')) + [root / 'Shared/SharedSiteInbox.swift', root / 'Lens/Assets.xcassets']
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
exttarget, extproduct, extconfigs, extsp, extfp, extrp, embed, proxy, dependency = map(uid, ['shareTarget','shareProduct','shareConfigs','shareSources','shareFrameworks','shareResources','embedExtensions','shareProxy','shareDependency'])
for rel in ['LensShare/ShareViewController.swift']:
    f, b = uid(rel), uid('build:' + rel)
    objects.append(f'{f} = {{isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = "{rel}"; sourceTree = "<group>"; }};')
    objects.append(f'{b} = {{isa = PBXBuildFile; fileRef = {f}; }};')
    refs.append(f)
sharedext = uid('share:shared')
objects.append(f'{sharedext} = {{isa = PBXBuildFile; fileRef = {uid("Shared/SharedSiteInbox.swift")}; }};')
embedfile = uid('embed:share')
objects += [
f'{extproduct} = {{isa = PBXFileReference; explicitFileType = "wrapper.app-extension"; path = LensShare.appex; sourceTree = BUILT_PRODUCTS_DIR; }};',
f'{embedfile} = {{isa = PBXBuildFile; fileRef = {extproduct}; settings = {{ATTRIBUTES = (RemoveHeadersOnCopy); }}; }};',
f'{embed} = {{isa = PBXCopyFilesBuildPhase; buildActionMask = 2147483647; dstPath = ""; dstSubfolderSpec = 13; files = ({embedfile}); name = "Embed App Extensions"; runOnlyForDeploymentPostprocessing = 0; }};',
f'{proxy} = {{isa = PBXContainerItemProxy; containerPortal = {project}; proxyType = 1; remoteGlobalIDString = {exttarget}; remoteInfo = LensShare; }};',
f'{dependency} = {{isa = PBXTargetDependency; target = {exttarget}; targetProxy = {proxy}; }};',
f'{exttarget} = {{isa = PBXNativeTarget; buildConfigurationList = {extconfigs}; buildPhases = ({extsp},{extfp},{extrp}); buildRules = (); dependencies = (); name = LensShare; productName = LensShare; productReference = {extproduct}; productType = "com.apple.product-type.app-extension"; }};',
f'{extsp} = {{isa = PBXSourcesBuildPhase; buildActionMask = 2147483647; files = ({uid("build:LensShare/ShareViewController.swift")},{sharedext}); runOnlyForDeploymentPostprocessing = 0; }};',
f'{extfp} = {{isa = PBXFrameworksBuildPhase; buildActionMask = 2147483647; files = (); runOnlyForDeploymentPostprocessing = 0; }};',
f'{extrp} = {{isa = PBXResourcesBuildPhase; buildActionMask = 2147483647; files = (); runOnlyForDeploymentPostprocessing = 0; }};',
]
objects += [
f'{project} = {{isa = PBXProject; attributes = {{LastUpgradeCheck = 2600; }}; buildConfigurationList = {pc}; compatibilityVersion = "Xcode 14.0"; developmentRegion = en; knownRegions = (en, Base); mainGroup = {group}; productRefGroup = {products}; projectDirPath = ""; targets = ({target},{exttarget}); }};',
f'{group} = {{isa = PBXGroup; children = ({",".join(refs)},{products}); sourceTree = "<group>"; }};',
f'{products} = {{isa = PBXGroup; children = ({product},{extproduct}); name = Products; sourceTree = "<group>"; }};',
f'{product} = {{isa = PBXFileReference; explicitFileType = wrapper.application; path = Lens.app; sourceTree = BUILT_PRODUCTS_DIR; }};',
f'{target} = {{isa = PBXNativeTarget; buildConfigurationList = {tc}; buildPhases = ({sp},{fp},{rp},{embed}); buildRules = (); dependencies = ({dependency}); name = Lens; productName = Lens; productReference = {product}; productType = "com.apple.product-type.application"; }};',
f'{sp} = {{isa = PBXSourcesBuildPhase; buildActionMask = 2147483647; files = ({",".join(sources)}); runOnlyForDeploymentPostprocessing = 0; }};',
f'{rp} = {{isa = PBXResourcesBuildPhase; buildActionMask = 2147483647; files = ({",".join(resources)}); runOnlyForDeploymentPostprocessing = 0; }};',
f'{fp} = {{isa = PBXFrameworksBuildPhase; buildActionMask = 2147483647; files = (); runOnlyForDeploymentPostprocessing = 0; }};',
]
for scope, configlist in [('project',pc),('target',tc),('share',extconfigs)]:
    configurations = []
    for mode in ['Debug','Release']:
        key = uid(scope+mode); configurations.append(key)
        settings = 'SDKROOT = iphoneos; IPHONEOS_DEPLOYMENT_TARGET = 17.0; SWIFT_VERSION = 5.0; CLANG_ENABLE_MODULES = YES;'
        if mode == 'Debug': settings += ' SWIFT_OPTIMIZATION_LEVEL = "-Onone"; DEBUG_INFORMATION_FORMAT = dwarf;'
        if scope == 'target':
            settings += ' ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon; PRODUCT_BUNDLE_IDENTIFIER = com.slpcc63.lens.browser; PRODUCT_NAME = Lens; GENERATE_INFOPLIST_FILE = YES; INFOPLIST_KEY_CFBundleDisplayName = Lens; INFOPLIST_FILE = Lens/Info.plist; INFOPLIST_KEY_UILaunchScreen_Generation = YES; INFOPLIST_KEY_ITSAppUsesNonExemptEncryption = NO; INFOPLIST_KEY_UISupportedInterfaceOrientations = "UIInterfaceOrientationPortrait UIInterfaceOrientationLandscapeLeft UIInterfaceOrientationLandscapeRight"; INFOPLIST_KEY_UISupportedInterfaceOrientations_iPad = "UIInterfaceOrientationPortrait UIInterfaceOrientationPortraitUpsideDown UIInterfaceOrientationLandscapeLeft UIInterfaceOrientationLandscapeRight"; INFOPLIST_KEY_UIApplicationSceneManifest_Generation = YES; INFOPLIST_KEY_NSFaceIDUsageDescription = "Unlock a saved website login."; INFOPLIST_KEY_NSLocationWhenInUseUsageDescription = "Allow a website you visit to use your location when you choose."; INFOPLIST_KEY_NSCameraUsageDescription = "Allow a website you visit to use your camera when you choose."; INFOPLIST_KEY_NSMicrophoneUsageDescription = "Allow a website you visit to use your microphone when you choose."; TARGETED_DEVICE_FAMILY = "1,2"; CODE_SIGN_STYLE = Automatic; CURRENT_PROJECT_VERSION = 6; MARKETING_VERSION = 0.1.0;'
        if scope == 'target':
            settings += ' CODE_SIGN_ENTITLEMENTS = Lens/Lens.entitlements; DEVELOPMENT_TEAM = 76GL5MBUM8;'
        if scope == 'share':
            settings += ' PRODUCT_BUNDLE_IDENTIFIER = com.slpcc63.lens.browser.share; PRODUCT_NAME = LensShare; INFOPLIST_FILE = LensShare/Info.plist; GENERATE_INFOPLIST_FILE = NO; CODE_SIGN_ENTITLEMENTS = LensShare/LensShare.entitlements; DEVELOPMENT_TEAM = 76GL5MBUM8; TARGETED_DEVICE_FAMILY = "1,2"; CODE_SIGN_STYLE = Automatic; SKIP_INSTALL = YES; APPLICATION_EXTENSION_API_ONLY = YES; CURRENT_PROJECT_VERSION = 6; MARKETING_VERSION = 0.1.0;'
        objects.append(f'{key} = {{isa = XCBuildConfiguration; buildSettings = {{{settings}}}; name = {mode}; }};')
    objects.append(f'{configlist} = {{isa = XCConfigurationList; buildConfigurations = ({",".join(configurations)}); defaultConfigurationIsVisible = 0; defaultConfigurationName = Release; }};')
directory = root / 'Lens.xcodeproj'
directory.mkdir(exist_ok=True)
(directory / 'project.pbxproj').write_text('// !$*UTF8*$!\n{ archiveVersion = 1; classes = {}; objectVersion = 56; objects = {\n'+'\n'.join(objects)+f'\n}}; rootObject = {project}; }}\n')
scheme = directory / 'xcshareddata/xcschemes'
scheme.mkdir(parents=True,exist_ok=True)
(scheme / 'Lens.xcscheme').write_text(f'''<?xml version="1.0" encoding="UTF-8"?>
<Scheme LastUpgradeVersion="2600" version="1.3"><BuildAction parallelizeBuildables="YES" buildImplicitDependencies="YES"><BuildActionEntries><BuildActionEntry buildForTesting="YES" buildForRunning="YES" buildForProfiling="YES" buildForArchiving="YES" buildForAnalyzing="YES"><BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="{target}" BuildableName="Lens.app" BlueprintName="Lens" ReferencedContainer="container:Lens.xcodeproj"/></BuildActionEntry></BuildActionEntries></BuildAction><LaunchAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" launchStyle="0" useCustomWorkingDirectory="NO" ignoresPersistentStateOnLaunch="NO" debugDocumentVersioning="YES" allowLocationSimulation="YES"><BuildableProductRunnable runnableDebuggingMode="0"><BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="{target}" BuildableName="Lens.app" BlueprintName="Lens" ReferencedContainer="container:Lens.xcodeproj"/></BuildableProductRunnable></LaunchAction><ArchiveAction buildConfiguration="Release" revealArchiveInOrganizer="YES"/></Scheme>''')
