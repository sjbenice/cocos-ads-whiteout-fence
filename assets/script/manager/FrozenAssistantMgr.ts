import { _decorator, Component, instantiate, Node, Prefab, random, randomRange, randomRangeInt, Vec3 } from 'cc';
import { Utils } from '../library/util/Utils';
import { FrozenAssistantController } from '../controller/FrozenAssistantController';
import { LevelUpController } from '../controller/LevelUpController';
import { FoodMgr } from './FoodMgr';
import { GhostMgr } from './GhostMgr';
const { ccclass, property } = _decorator;

@ccclass('FrozenAssistantMgr')
export class FrozenAssistantMgr extends Component {
    @property(Node)
    frozenPos:Node = null;

    @property(Node)
    workPos:Node = null;

    @property(Prefab)
    assistantPrefab:Prefab = null;

    @property
    initialCount:number = 3;

    @property
    totalCount:number = 9;

    @property(Node)
    fenceGroup:Node = null;

    @property(Node)
    sheepGroup:Node = null;

    @property(LevelUpController)
    levelUp:LevelUpController = null;

    @property(FoodMgr)
    foodMgr:FoodMgr = null;

    @property(GhostMgr)
    ghostMgr:GhostMgr = null;

    protected _placeOrigins:Vec3[] = [];
    protected _placeHalfDimensions:Vec3[] = [];

    protected _tempPos:Vec3 = Vec3.ZERO.clone();
    protected _tempPos2:Vec3 = Vec3.ZERO.clone();

    protected _firstStep:boolean = true;
    protected _timer:number = 0;

    protected onLoad(): void {
        if (this.frozenPos) {
            while (this.frozenPos.children.length > 0) {
                this._placeOrigins.push(this.frozenPos.children[0].getPosition());
                this._placeHalfDimensions.push(Utils.calcArrangeDimension(this.frozenPos));
            }
        }
    }

    protected start(): void {
        for (let index = 0; index < this.initialCount; index++) {
            this.createFrozenAssistant(true);            
        }
    }

    protected getPlacePos(placeIndex:number, out:Vec3) {
        out.x = randomRange(-this._placeHalfDimensions[placeIndex].x, this._placeHalfDimensions[placeIndex].x) + this._placeOrigins[placeIndex].x;
        out.z = randomRange(-this._placeHalfDimensions[placeIndex].z, this._placeHalfDimensions[placeIndex].z) + this._placeOrigins[placeIndex].z;
        out.y = 0;
    }

    protected createFrozenAssistant(firstSection:boolean) {
        if (this.assistantPrefab && this._placeHalfDimensions.length) {
            const element = instantiate(this.assistantPrefab);
            this.frozenPos.addChild(element);

            while (true) {
                this.getPlacePos(firstSection ? 0 : randomRangeInt(0, this._placeOrigins.length), this._tempPos);

                let valid:boolean = true;
                this.frozenPos.children.forEach(node => {
                    if (Vec3.squaredDistance(node.position, this._tempPos) < 2)
                        valid = false;
                });
                if (valid)
                    break;
            }

            element.setPosition(this._tempPos);
            // this._tempPos.set(Vec3.ZERO);
            // this._tempPos.y = random() * 360;
            // element.setRotationFromEuler(this._tempPos);

            const assistant = element.getComponent(FrozenAssistantController);
            if (assistant) {
                assistant.workPos = this.workPos;
                assistant.fenceGroup = this.fenceGroup;
                assistant.sheepGroup = this.sheepGroup;
                assistant.levelUp = this.levelUp;
                assistant.foodMgr = this.foodMgr;
                assistant.ghostMgr = this.ghostMgr;
            }
        }
    }

    protected lateUpdate(dt: number): void {
        if (this._firstStep) {
            if (this.frozenPos.children.length < this.initialCount)
                this._firstStep = false;
        } else {
            this._timer += dt;
            if (this._timer > 2) {
                this._timer = 0;
                if (this.frozenPos.children.length + this.workPos.children.length < this.totalCount) {
                    this.createFrozenAssistant(false);
                }
            }
        }
    }

    public findNearst(node:Node) : Node {
        let minDistance = Infinity;
        let nearGhost:Node = null;

        node.getWorldPosition(this._tempPos);
        this._tempPos.y = 0;

        for (let index = 0; index < this.frozenPos.children.length; index++) {
            const ghost = this.frozenPos.children[index].getComponent(FrozenAssistantController);
            if (ghost && ghost.isFrozen()) {
                ghost.node.getWorldPosition(this._tempPos2);
                
                this._tempPos2.y = 0;

                const distance = Vec3.distance(this._tempPos, this._tempPos2);

                if (distance < minDistance) {
                    minDistance = distance;

                    nearGhost = ghost.node;
                }
            }
        }

        return nearGhost;
    }
}


