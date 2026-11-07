import Schema from '@deepseek-ai/schemastery';

export const name = 'global-pins';
export const Config = Schema.object({
  // Accept older profiles; native rows and their active theme now own density.
  density: Schema.union(['default', 'compact']).default('default'),
  placement: Schema.union(['above', 'inside']).default('above').volatile(),
});

// Only presentation preferences are persisted; pins stay with the native controller.
export function apply(ctx) {
  ctx.inject(['settings'], child => {
    child.effect(() => child.settings.configure({ auto: false }, ctx.fiber));
  });
}
