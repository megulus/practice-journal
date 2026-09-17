# What `cap add ios` produces in the default (SPM) mode

`CapApp-SPM-Package.swift` is the manifest Capacitor 8.5.2 generated with its
**default** package manager (Swift Package Manager), with
`@capacitor-community/speech-recognition@7.0.1` installed.

Note what is *not* in it: the speech-recognition plugin. The plugin ships a
`.podspec` and no `Package.swift`, so `cap add ios` warned

    [warn] @capacitor-community/speech-recognition does not have a Package.swift
    [warn] Some installed Capacitor plugins are not compatible with SPM

and left it out. The app would build and the JS calls would fail at runtime.
That is why `ios/` in this spike was regenerated with
`npx cap add ios --packagemanager CocoaPods` (see `../A8-cap-add-ios-cocoapods-linux.log`).
