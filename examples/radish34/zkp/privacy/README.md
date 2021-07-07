# @baseline-protocol/privacy

Baseline core privacy package.

## Installation

`npm install @baseline-protocol/privacy`

## Building

You can build the package locally with `npm run build`.

## Interfaces

__IZKSnarkCircuitProvider__

```
compile(source: string, location: string): Promise<any>;
computeWitness(artifacts: any, args: any[]): Promise<any>;
exportVerifier(verifyingKey): Promise<string>;
generateProof(circuit, witness, provingKey): Promise<string>;
setup(circuit): Promise<any>;
```

## Supported Frontends

The following zkSNARK toolboxes are supported:

- ZoKrates

## Architecture/Flow

![baseline-zok-flow-3](https://user-images.githubusercontent.com/35908605/93899433-4df55480-fcc2-11ea-86db-243eb5f218b6.png)
