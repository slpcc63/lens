// Platform export of the existing Lens mark, not a new identity design.
import AppKit
import ImageIO
let root = URL(fileURLWithPath: CommandLine.arguments[1])
let source = root.appendingPathComponent("assets/doxle-icons/256/filter.png")
let output = root.appendingPathComponent("ios/Lens/Assets.xcassets/AppIcon.appiconset")
try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)
guard let input = CGImageSourceCreateWithURL(source as CFURL, nil),
      let mark = CGImageSourceCreateImageAtIndex(input, 0, nil),
      let context = CGContext(data: nil, width: 1024, height: 1024, bitsPerComponent: 8,
        bytesPerRow: 4096, space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue) else { fatalError("Cannot export Lens icon") }
context.setFillColor(CGColor(red: 11.0/255, green: 16.0/255, blue: 35.0/255, alpha: 1))
context.fill(CGRect(x: 0, y: 0, width: 1024, height: 1024))
context.interpolationQuality = .high
context.draw(mark, in: CGRect(x: 0, y: 0, width: 1024, height: 1024))
let bitmap = NSBitmapImageRep(cgImage: context.makeImage()!)
try bitmap.representation(using: .png, properties: [:])!.write(to: output.appendingPathComponent("Lens-1024.png"))
let manifest = """
{"images":[{"filename":"Lens-1024.png","idiom":"universal","platform":"ios","size":"1024x1024"}],"info":{"author":"xcode","version":1}}
"""
try manifest.write(to: output.appendingPathComponent("Contents.json"), atomically: true, encoding: .utf8)
