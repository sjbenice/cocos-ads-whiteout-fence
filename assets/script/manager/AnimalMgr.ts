import { _decorator, Component, Enum, EPSILON, instantiate, Node, Prefab, random, randomRange, randomRangeInt, Vec3 } from 'cc';
import { Utils } from '../library/util/Utils';
import { AnimalController } from '../controller/AnimalController';
import { GameState, GameStateMgr } from '../library/GameState';
const { ccclass, property } = _decorator;

@ccclass('AnimalMgr')
export class AnimalMgr extends Component {
    @property({ type: Enum(GameState) })
    gameState: GameState = GameState.NONE;

    @property(Node)
    placePos:Node = null;

    @property(Node)
    trashPos:Node = null;

    @property(Prefab)
    animalPrefab:Prefab = null;

    @property
    initialCount:number = 6;

    @property
    initInterval:number = 0.1;

    @property(Node)
    cameraNode:Node = null;

    protected _placeOrigins:Vec3[] = [];
    protected _placeHalfDimensions:Vec3[] = [];

    protected _timer:number = 0;
    protected _initialCount:number = 0;
    protected _tempPos:Vec3 = Vec3.ZERO.clone();

    protected onLoad(): void {
        if (this.placePos) {
            while (this.placePos.children.length > 0) {
                this._placeOrigins.push(this.placePos.children[0].getPosition());
                this._placeHalfDimensions.push(Utils.calcArrangeDimension(this.placePos));
            }

        }
    }

    protected start(): void {
        if (this.gameState > GameState.NONE)
            GameStateMgr.setState(this.gameState);
    }
    
    protected lateUpdate(dt: number): void {
        if (this.initialCount > this._initialCount) {
            this._timer += dt;
            if (this._timer > this.initInterval) {
                this._timer = 0;
                this._initialCount ++;
                if (this.animalPrefab && this._placeHalfDimensions.length) {
                    const element = instantiate(this.animalPrefab);
                    this.placePos.addChild(element);

                    while (true) {
                        const placeIndex = randomRangeInt(0, this._placeOrigins.length);
                        this._tempPos.x = randomRange(-this._placeHalfDimensions[placeIndex].x, this._placeHalfDimensions[placeIndex].x) + this._placeOrigins[placeIndex].x;
                        this._tempPos.z = randomRange(-this._placeHalfDimensions[placeIndex].z, this._placeHalfDimensions[placeIndex].z) + this._placeOrigins[placeIndex].z;
                        this._tempPos.y = 0.2;

                        let valid:boolean = true;
                        this.placePos.children.forEach(node => {
                            if (Vec3.squaredDistance(node.position, this._tempPos) < 2)
                                valid = false;
                        });
                        if (valid)
                            break;
                    }
        
                    element.setPosition(this._tempPos);
                    this._tempPos.set(Vec3.ZERO);
                    this._tempPos.y = random() * 360;
                    element.setRotationFromEuler(this._tempPos);
                    
                    const animal = element.getComponent(AnimalController);
                    if (animal) {
                        // animal.fieldHalfDimetion = this._placeHalfDimension;
                        animal.cameraNode = this.cameraNode;
                        animal.trashPos = this.trashPos;
                    }
                }
            }
        }
    }
}


