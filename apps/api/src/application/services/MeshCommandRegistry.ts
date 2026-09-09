import type { MeshAction } from "../../domain/repositories/MeshGateway";

export class MeshCommandRegistry {
    private readonly inFlight = new Map<number, MeshAction>();

    begin(nodeId: number, action: MeshAction): boolean {
        if (this.inFlight.has(nodeId)) return false;
        this.inFlight.set(nodeId, action);
        return true;
    }

    current(nodeId: number): MeshAction | undefined {
        return this.inFlight.get(nodeId);
    }

    end(nodeId: number): void {
        this.inFlight.delete(nodeId);
    }
}
